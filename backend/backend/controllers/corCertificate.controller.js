exports.listAll = async (req, res, next) => {
  try {
    const { CORCertificate } = require('../models');
    const { success } = require('../utils/responseHelper');
    const where = {};
    if (req.query.is_issued === 'false') where.is_issued = false;
    if (req.query.is_issued === 'true')  where.is_issued = true;
    const certs = await CORCertificate.findAll({ where, order: [['created_at','DESC']], limit: 100 });
    return success(res, certs);
  } catch (err) { next(err); }
};

const { CORCertificate, CORApplication, Application, User } = require('../models');
const trackingLineService = require('../services/trackingLine.service');
const certService       = require('../services/certificate.service');
const lockdownService   = require('../services/lockdown.service');
const printControlService = require('../services/printControl.service');
const { OTP } = require('../models');
const bcryptCert = require('bcryptjs');
const { sign, verify }  = require('../utils/digitalSignature');
const notifService      = require('../services/notification.service');
const { success, created, notFound, badRequest, forbidden, error } = require('../utils/responseHelper');

exports.generateCORCertificate = async (req, res, next) => {
  try {
    const { reference_number, cor_application_id, final_inspection_id, compliance_notes } = req.body;
    const certData = await certService.generateCORCertificate({ reference_number, compliance_notes });
    const cert = await CORCertificate.create({
      reference_number, cor_application_id, final_inspection_id,
      cor_number:        certData.corNumber,
      verification_code: certData.verificationCode,
      qr_code_path:      certData.qrPath,
      pdf_path:          certData.pdfPath,
      digital_signature: certData.signature,
      compliance_notes,
    });
    return created(res, cert);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const cert = await CORCertificate.findOne({ where: { reference_number: req.params.ref } });
    if (!cert) return notFound(res);
    return success(res, cert);
  } catch (err) { next(err); }
};

exports.getCORViewOnly = async (req, res, next) => {
  try {
    const cert = await CORCertificate.findOne({
      where: { reference_number: req.params.ref },
      attributes: ['cor_number','verification_code','compliance_notes','is_issued','issued_at'],
    });
    if (!cert) return notFound(res);
    return success(res, {
      ...cert.toJSON(),
      can_download: false,
      message: 'Please collect the official stamped copy at the Pradeshiya Sabha office.',
    });
  } catch (err) { next(err); }
};

exports.getByCode = async (req, res, next) => {
  try {
    const cert = await CORCertificate.findOne({ where: { cor_number: req.params.code } });
    if (!cert) return notFound(res);
    return success(res, cert);
  } catch (err) { next(err); }
};

/**
 * PUT /:id/sign  — requires OTP confirmation (same security as approval certificate)
 */
exports.applyDigitalSignature = async (req, res, next) => {
  try {
    const { otp_code } = req.body;
    if (!otp_code) return badRequest(res, 'otp_code is required to sign the COR certificate');

    const cert = await CORCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res, 'COR Certificate not found');
    if (cert.is_immutable) return forbidden(res, 'COR Certificate is already signed and locked');

    // Validate OTP
    const signer = await User.findByPk(req.user.user_id);
    if (!signer) return forbidden(res, 'Signing user not found');
    const crypto = require('crypto');
    // Hash the incoming plaintext OTP before comparing — stored value is SHA-256 hash
    const hashedInput = crypto.createHash('sha256').update(String(otp_code).trim()).digest('hex');
    const safeEqual = (a, b) => {
      try { return crypto.timingSafeEqual(Buffer.from(String(a)), Buffer.from(String(b))); }
      catch { return false; }
    };
    if (!signer.otp_code || !safeEqual(signer.otp_code, hashedInput)) {
      return forbidden(res, 'Invalid OTP code');
    }
    if (!signer.otp_expires_at || new Date() > new Date(signer.otp_expires_at)) {
      return forbidden(res, 'OTP has expired. Please generate a new OTP.');
    }

    const payload = {
      cor_number:        cert.cor_number,
      verification_code: cert.verification_code,
      signed_by:         req.user.user_id,
      signed_at:         new Date().toISOString(),
    };
    const signature = sign(payload);

    await cert.update({ digital_signature: signature, signed_by: req.user.user_id, signed_at: new Date() });

    // Consume OTP
    await signer.update({ otp_code: null, otp_expires_at: null });

    await lockdownService.lockRecord(CORCertificate, req.params.id);

    return success(res, {
      cor_number:  cert.cor_number,
      signed_at:   new Date(),
      is_immutable: true,
    }, 'COR Certificate signed and locked');
  } catch (err) { next(err); }
};

exports.recordManualSeal = async (req, res, next) => {
  try {
    await CORCertificate.update({ manual_seal_applied: true, seal_applied_by: req.user.user_id, seal_applied_at: new Date() }, { where: { cor_certificate_id: req.params.id } });
    return success(res, null, 'Manual seal recorded');
  } catch (err) { next(err); }
};

exports.issueCORCertificate = async (req, res, next) => {
  try {
    const cert = await CORCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res);
    if (!cert.digital_signature && !cert.manual_seal_applied) {
      return badRequest(res, 'COR Certificate must be signed or sealed before issuing');
    }
    await cert.update({ is_issued: true, issued_at: new Date(), issued_by: req.user.user_id });

    // Update application status to COR_ISSUED and add COR_ISSUED tracking node
    const ref = cert.reference_number;
    if (ref) {
      await Application.update({ status: 'COR_ISSUED' }, { where: { reference_number: ref } });
      try {
        const { TrackingLine } = require('../models');
        const line = await TrackingLine.findOne({ where: { reference_number: ref } });
        if (line) {
          await trackingLineService.addNode(
            line.tracking_line_id, ref,
            'COR_ISSUED', 'Certificate of Residence Issued',
            req.user.user_id, true  // is_visible_to_applicant = true
          );
        }
      } catch (nodeErr) {
        // Non-fatal — certificate still issued even if node creation fails
        console.error('[COR] Tracking node creation failed:', nodeErr.message);
      }
      // Notify applicant
      try {
        const corApp = await CORApplication.findOne({ where: { reference_number: ref } });
        if (corApp) {
          const { Application: App } = require('../models');
          const app = await App.findOne({ where: { reference_number: ref } });
          if (app) {
            await notifService.dispatch({
              recipient_id: app.applicant_id,
              event_type: 'COR_ISSUED',
              title: 'Certificate of Residence Issued',
              body: 'Your Certificate of Residence has been issued. Please collect the stamped certificate at the Pradeshiya Sabha office.',
              reference_number: ref,
              channel: 'IN_APP',
            });
          }
        }
      } catch (notifErr) {
        console.error('[COR] Notification failed:', notifErr.message);
      }
    }
    return success(res, null, 'COR Certificate issued');
  } catch (err) { next(err); }
};

exports.verifyCORCertificate = async (req, res, next) => {
  try {
    const cert = await CORCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res);
    const valid = verify({ cor_number: cert.cor_number, verification_code: cert.verification_code }, cert.digital_signature);
    return success(res, { valid, cor_number: cert.cor_number, issued: cert.is_issued });
  } catch (err) { next(err); }
};

exports.generateQRCode = async (req, res, next) => {
  try {
    const cert = await CORCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res);
    return success(res, { qr_code_path: cert.qr_code_path });
  } catch (err) { next(err); }
};

exports.printCORCertificate = async (req, res, next) => {
  try {
    const cert = await CORCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res);
    if (!cert.is_issued) return badRequest(res, 'COR Certificate has not been issued yet');

const { log, isFirst, printNumber } = await printControlService.recordPrint(
      cert.cor_certificate_id, 'COR', cert.reference_number, req.user.user_id, req.body.reason
    );

    if (!isFirst) {
      // Resolve Chairman from DB — never trust caller-supplied chairman_id
      try {
const { User } = require('../models');
        const chairman = await User.findOne({ where: { role: 'CHAIRMAN', status: 'ACTIVE' }, attributes: ['user_id'] });
        if (chairman) {
          await notifService.dispatch({
            recipient_id:     chairman.user_id,
            event_type:       'REPRINT_NOTIFICATION',
            title:            'COR Certificate Reprint Alert',
            body:             `Reprint #${printNumber} for COR ${cert.cor_number} (${cert.reference_number}). Reason: ${req.body.reason || 'Not provided'}`,
            reference_number: cert.reference_number,
          });
        }
      } catch (ne) { console.error('[REPRINT] Chairman notify error:', ne.message); }
    }
    return success(res, { log, print_number: printNumber, is_reprint: !isFirst });
  } catch (err) { next(err); }
};

exports.lockCORCertificate = async (req, res, next) => {
  try {
    await lockdownService.lockRecord(CORCertificate, req.params.id);
    return success(res, null, 'COR Certificate locked');
  } catch (err) { next(err); }
};

exports.printCORCertificate = async (req, res, next) => {
  try {
    const cert = await CORCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res, 'COR Certificate not found');
    if (!cert.is_issued) return badRequest(res, 'COR Certificate has not been issued yet');

    const { log, isFirst, printNumber } = await printControlService.recordPrint(
      cert.cor_certificate_id, 'COR', cert.reference_number,
      req.user.user_id, req.body.reason,
    );

    if (!isFirst) {
      const { User } = require('../models');
      const chairman = await User.findOne({ where: { role: 'CHAIRMAN', status: 'ACTIVE' }, attributes: ['user_id'] });
      if (chairman) {
        await notifService.dispatch({
          recipient_id:     chairman.user_id,
          event_type:       'REPRINT_NOTIFICATION',
          title:            'COR Certificate Reprint Alert',
          body:             `Print #${printNumber} of COR certificate ${cert.cor_number} (${cert.reference_number}). Reason: ${req.body.reason || 'Not provided'}`,
          reference_number: cert.reference_number,
        });
      }
    }
    return success(res, { log, print_number: printNumber, is_reprint: !isFirst });
  } catch (err) { next(err); }
};
