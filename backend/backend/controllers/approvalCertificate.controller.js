/**
 * approvalCertificate.controller.js
 *
 * Fix: Chairman sign endpoint now requires OTP verification before affixing signature.
 * Flow: PUT /:id/sign  →  verifies otp_code + otp_expires_at on User row
 *       →  if valid, affixes signature + locks cert + clears OTP
 *
 * Callers should first hit POST /auth/generate-otp to send OTP to Chairman,
 * then submit { otp_code } along with the sign request.
 */

const { ApprovalCertificate, Application, Decision, User } = require('../models');
const certService       = require('../services/certificate.service');
const lockdownService   = require('../services/lockdown.service');
const printControlService = require('../services/printControl.service');
const { sign, verify }  = require('../utils/digitalSignature');
const notifService      = require('../services/notification.service');
const { success, created, notFound, badRequest, forbidden, error } = require('../utils/responseHelper');

exports.generateCertificate = async (req, res, next) => {
  try {
    const { reference_number, application_id, decision_id, conditions, approval_date, expiry_date } = req.body;
    const certData = await certService.generateApprovalCertificate({
      reference_number, application_id, conditions, approval_date, expiry_date,
    });
    const cert = await ApprovalCertificate.create({
      reference_number, application_id, decision_id,
      certificate_number:  certData.certNumber,
      verification_code:   certData.verificationCode,
      qr_code_path:        certData.qrPath,
      pdf_path:            certData.pdfPath,
      digital_signature:   certData.signature,
      conditions, approval_date, expiry_date,
    });
    return created(res, cert);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const cert = await ApprovalCertificate.findOne({ where: { reference_number: req.params.ref } });
    if (!cert) return notFound(res);
    return success(res, cert);
  } catch (err) { next(err); }
};

exports.getCertificateViewOnly = async (req, res, next) => {
  try {
    const cert = await ApprovalCertificate.findOne({
      where: { reference_number: req.params.ref },
      attributes: ['certificate_number','verification_code','approval_date','expiry_date','conditions','is_issued','issued_at'],
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
    const cert = await ApprovalCertificate.findOne({ where: { certificate_number: req.params.code } });
    if (!cert) return notFound(res);
    return success(res, cert);
  } catch (err) { next(err); }
};

/**
 * PUT /:id/sign
 *
 * Requires body: { otp_code: "123456" }
 * Steps:
 *   1. Load cert + Chairman user record
 *   2. Validate OTP (code match + not expired)
 *   3. Affix RSA/HMAC digital signature
 *   4. Clear OTP fields on User row (one-time use)
 *   5. Lock certificate (is_immutable = true)
 */
exports.applyDigitalSignature = async (req, res, next) => {
  try {
    const { otp_code } = req.body;
    if (!otp_code) return badRequest(res, 'otp_code is required to sign the certificate');

    // ── Load certificate ──────────────────────────────────────────────────────
    const cert = await ApprovalCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res, 'Certificate not found');
    if (cert.is_immutable) return forbidden(res, 'Certificate is already signed and locked');

    // ── Validate OTP ──────────────────────────────────────────────────────────
    const chairman = await User.findByPk(req.user.user_id);
    if (!chairman) return forbidden(res, 'Chairman user not found');

    const crypto = require('crypto');
    // otp_code in DB is now a SHA-256 hash — hash the incoming code for comparison
    const hashedInput = crypto.createHash('sha256').update(String(otp_code).trim()).digest('hex');
    const safeEqual = (a, b) => { try { return crypto.timingSafeEqual(Buffer.from(String(a)), Buffer.from(String(b))); } catch { return false; } };
    if (!chairman.otp_code || !safeEqual(chairman.otp_code, hashedInput)) {
      return forbidden(res, 'Invalid OTP code');
    }
    if (!chairman.otp_expires_at || new Date() > new Date(chairman.otp_expires_at)) {
      return forbidden(res, 'OTP has expired. Please generate a new OTP and try again.');
    }

    // ── Affix digital signature ───────────────────────────────────────────────
    const payload = {
      certificate_number: cert.certificate_number,
      verification_code:  cert.verification_code,
      signed_by:          req.user.user_id,
      signed_at:          new Date().toISOString(),
    };
    const signature = sign(payload);

    await cert.update({
      digital_signature: signature,
      signed_by:         req.user.user_id,
      signed_at:         new Date(),
    });

    // ── Consume OTP (one-time use) ────────────────────────────────────────────
    await chairman.update({ otp_code: null, otp_expires_at: null });

    // ── Lock certificate ──────────────────────────────────────────────────────
    await lockdownService.lockRecord(ApprovalCertificate, req.params.id);

    return success(res, {
      certificate_number: cert.certificate_number,
      signed_at:          cert.signed_at,
      is_immutable:       true,
    }, 'Certificate digitally signed by Chairman and locked successfully');
  } catch (err) { next(err); }
};

exports.recordManualSeal = async (req, res, next) => {
  try {
    await ApprovalCertificate.update({
      manual_seal_applied: true,
      seal_applied_by:     req.user.user_id,
      seal_applied_at:     new Date(),
    }, { where: { certificate_id: req.params.id } });
    return success(res, null, 'Manual seal recorded');
  } catch (err) { next(err); }
};

exports.issueCertificate = async (req, res, next) => {
  try {
    const cert = await ApprovalCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res);
    if (!cert.digital_signature && !cert.manual_seal_applied) {
      return badRequest(res, 'Certificate must be signed by Chairman before issuing');
    }
    await cert.update({ is_issued: true, issued_at: new Date(), issued_by: req.user.user_id });
    return success(res, null, 'Certificate issued successfully');
  } catch (err) { next(err); }
};

exports.verifyCertificate = async (req, res, next) => {
  try {
    const cert = await ApprovalCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res);
    const valid = verify(
      { certificate_number: cert.certificate_number, verification_code: cert.verification_code },
      cert.digital_signature,
    );
    return success(res, {
      valid,
      certificate_number: cert.certificate_number,
      issued:             cert.is_issued,
      expiry_date:        cert.expiry_date,
    });
  } catch (err) { next(err); }
};

exports.generateQRCode = async (req, res, next) => {
  try {
    const cert = await ApprovalCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res);
    return success(res, { qr_code_path: cert.qr_code_path });
  } catch (err) { next(err); }
};

exports.printCertificate = async (req, res, next) => {
  try {
    const cert = await ApprovalCertificate.findByPk(req.params.id);
    if (!cert) return notFound(res);
    if (!cert.is_issued) return badRequest(res, 'Certificate has not been issued yet');

    const { log, isFirst, printNumber } = await printControlService.recordPrint(
      cert.certificate_id, 'APPROVAL', cert.reference_number,
      req.user.user_id, req.body.reason,
    );

    if (!isFirst) {
      // Resolve Chairman from DB — never trust caller-supplied chairman_id
      const { User } = require('../models');
      const chairman = await User.findOne({ where: { role: 'CHAIRMAN', status: 'ACTIVE' }, attributes: ['user_id'] });
      if (chairman) {
        await notifService.dispatch({
          recipient_id:     chairman.user_id,
          event_type:       'REPRINT_NOTIFICATION',
          title:            'Certificate Reprint Alert',
          body:             `Print #${printNumber} of certificate ${cert.certificate_number} (${cert.reference_number}). Reason: ${req.body.reason || 'Not provided'}`,
          reference_number: cert.reference_number,
        });
      }
    }
    return success(res, { log, print_number: printNumber, is_reprint: !isFirst });
  } catch (err) { next(err); }
};

exports.lockCertificate = async (req, res, next) => {
  try {
    await lockdownService.lockRecord(ApprovalCertificate, req.params.id);
    return success(res, null, 'Certificate locked');
  } catch (err) { next(err); }
};

/**
 * POST /approval-certificates/batch-sign
 *
 * Chairman signs multiple certificates with a single OTP.
 * Body: { otp_code: "123456", certificate_ids: ["uuid1","uuid2",...] }
 *
 * Flow:
 *  1. Validate OTP once against the Chairman's stored (hashed) OTP
 *  2. For each certificate_id: affix signature + lock
 *  3. Consume OTP (one-time use regardless of how many certs signed)
 *  4. Return per-cert results so frontend can show partial success
 */
exports.batchSign = async (req, res, next) => {
  try {
    const { otp_code, certificate_ids } = req.body;
    if (!otp_code) return badRequest(res, 'otp_code is required');
    if (!Array.isArray(certificate_ids) || certificate_ids.length === 0) {
      return badRequest(res, 'certificate_ids must be a non-empty array');
    }

    // ── Validate Chairman OTP once ─────────────────────────────────────────
    const chairman = await User.findByPk(req.user.user_id);
    if (!chairman) return forbidden(res, 'Chairman user not found');

    const crypto = require('crypto');
    const hashedInput = crypto.createHash('sha256').update(String(otp_code).trim()).digest('hex');
    const safeEqual = (a, b) => {
      try { return crypto.timingSafeEqual(Buffer.from(String(a)), Buffer.from(String(b))); }
      catch { return false; }
    };

    if (!chairman.otp_code || !safeEqual(chairman.otp_code, hashedInput)) {
      return forbidden(res, 'Invalid OTP code');
    }
    if (!chairman.otp_expires_at || new Date() > new Date(chairman.otp_expires_at)) {
      return forbidden(res, 'OTP has expired. Please generate a new OTP and try again.');
    }

    // ── Sign each certificate ──────────────────────────────────────────────
    const results = [];
    const signedAt = new Date();

    for (const certId of certificate_ids) {
      try {
        const cert = await ApprovalCertificate.findByPk(certId);
        if (!cert) {
          results.push({ certificate_id: certId, success: false, reason: 'Not found' });
          continue;
        }
        if (cert.is_immutable) {
          results.push({ certificate_id: certId, certificate_number: cert.certificate_number, success: false, reason: 'Already signed and locked' });
          continue;
        }

        const payload = {
          certificate_number: cert.certificate_number,
          verification_code:  cert.verification_code,
          signed_by:          req.user.user_id,
          signed_at:          signedAt.toISOString(),
        };
        const signature = sign(payload);

        await cert.update({ digital_signature: signature, signed_by: req.user.user_id, signed_at: signedAt });
        await lockdownService.lockRecord(ApprovalCertificate, certId);

        results.push({ certificate_id: certId, certificate_number: cert.certificate_number, success: true, signed_at: signedAt });
      } catch (certErr) {
        results.push({ certificate_id: certId, success: false, reason: certErr.message });
      }
    }

    // ── Consume OTP (one-time use) ─────────────────────────────────────────
    await chairman.update({ otp_code: null, otp_expires_at: null });

    const successCount = results.filter(r => r.success).length;
    return success(res, {
      signed_count: successCount,
      total_requested: certificate_ids.length,
      results,
    }, `${successCount} of ${certificate_ids.length} certificate(s) signed successfully`);
  } catch (err) { next(err); }
};

exports.listAll = async (req, res, next) => {
  try {
    const { ApprovalCertificate } = require('../models');
    const where = {};
    // Support filtering by real model columns (certificate_status does not exist)
    if (req.query.is_issued !== undefined) where.is_issued = req.query.is_issued === 'true';
    if (req.query.signed === 'false')      where.signed_by = null;
    if (req.query.issued === 'false')      where.is_issued = false;
    if (req.query.reference_number)        where.reference_number = req.query.reference_number;
    const certs = await ApprovalCertificate.findAll({ where, order: [['created_at','DESC']], limit: 200 });
    return require('../utils/responseHelper').success(res, certs);
  } catch (err) { require('../utils/responseHelper').error(res, err.message); }
};

/**
 * GET /approval-certificates/ref/:ref/download
 *
 * Returns the certificate PDF path only when:
 *  1. The certificate is signed (digital_signature present)
 *  2. The certificate is issued (is_issued = true)
 *  3. The corresponding approval fee Payment record is PAID
 *
 * Spec: "allowing to download the application only when payment is done"
 */
exports.downloadCertificate = async (req, res, next) => {
  try {
    const { Payment } = require('../models');

    const cert = await ApprovalCertificate.findOne({ where: { reference_number: req.params.ref } });
    if (!cert) return notFound(res, 'Certificate not found');

    if (!cert.digital_signature) {
      return badRequest(res, 'Certificate has not been signed by the Chairman yet.');
    }
    if (!cert.is_issued) {
      return badRequest(res, 'Certificate has not been issued yet.');
    }

    // Gate: approval fee must be PAID
    const approvalPayment = await Payment.findOne({
      where: {
        reference_number: req.params.ref,
        payment_type:     'APPROVAL_FEE',
        payment_status:   'PAID',
      },
    });
    if (!approvalPayment) {
      return badRequest(res, 'Approval fee payment is required before downloading the certificate. Please complete payment first.');
    }

    return success(res, {
      pdf_path:           cert.pdf_path,
      certificate_number: cert.certificate_number,
      can_download:       true,
    }, 'Certificate is available for download');
  } catch (err) { next(err); }
};
