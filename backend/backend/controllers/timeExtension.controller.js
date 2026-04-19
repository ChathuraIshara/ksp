/**
 * timeExtension.controller.js — complete implementation
 * Covers all 10 endpoints defined in timeExtension.routes.js
 */

const { TimeExtension, Application, TrackingLine, User, Applicant, Payment } = require('../models');
const expiryTracker       = require('../services/expiryTracker.service');

// Resolve applicant's user_id for notifications (notifications need user_id not applicant_id)
const getApplicantUserId = async (applicantId) => {
  if (!applicantId) return null;
  const a = await Applicant.findByPk(applicantId, { attributes: ['user_id'] });
  return a?.user_id || null;
};
const feeCalcService      = require('../services/feeCalculator.service');
const trackingLineService = require('../services/trackingLine.service');
const notifService        = require('../services/notification.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

// ── Helpers ───────────────────────────────────────────────────────────────────

const getApp = async (referenceNumber) => Application.findOne({ where: { reference_number: referenceNumber } });

const addExtensionTrackingNode = async (referenceNumber, extensionNumber, newExpiry) => {
  try {
    const line = await TrackingLine.findOne({ where: { reference_number: referenceNumber } });
    if (line) {
      await trackingLineService.addNode(
        line.tracking_line_id, referenceNumber, 'TIME_EXTENSION',
        `Time Extension #${extensionNumber} — New expiry: ${new Date(newExpiry).toLocaleDateString('en-LK')}`,
      );
    }
  } catch (e) {
    console.error('[TIME_EXT] Tracking node error:', e.message);
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * POST /extensions — create and grant a time extension
 */
exports.createExtension = async (req, res, next) => {
  try {
    const { reference_number, extension_years = 1, reason } = req.body;
    if (!reference_number) return badRequest(res, 'reference_number is required');

    const app = await getApp(reference_number);
    if (!app) return notFound(res, 'Application not found');
    if ((app.extension_count || 0) >= 2) {
      return badRequest(res, 'Maximum of 2 time extensions allowed per approval');
    }

    const fee        = await feeCalcService.calculateExtensionFee({ planTypeId: app.plan_type_id });
    const newExpiry  = await expiryTracker.extendDeadline(app.application_id, extension_years);
    const extNumber  = (app.extension_count || 0) + 1;

    await app.update({
      extension_count:      extNumber,
      reminder_6month_sent: false,
      reminder_3month_sent: false,
      reminder_1month_sent: false,
      status: app.status === 'EXPIRED' ? 'CERTIFICATE_READY' : app.status,
    });

    const ext = await TimeExtension.create({
      application_id:   app.application_id,
      reference_number,
      requested_by:     req.body.requested_by || req.user.user_id,
      extension_number: extNumber,
      extension_years,
      fee_amount:       fee,
      reason,
      new_expiry_date:  newExpiry,
      granted_by:       req.user.user_id,
      granted_at:       new Date(),
      status:           'APPROVED',
    });

    // Create a PENDING Payment record so applicant can pay the extension fee
    let paymentRecord = null;
    if (fee > 0) {
      paymentRecord = await Payment.create({
        reference_number,
        application_id:  app.application_id,
        payment_type:    'EXTENSION_FEE',
        amount:          fee,
        payment_method:  'ONLINE',
        payment_status:  'PENDING',
        recorded_by:     req.user.user_id,
      });
      // Link payment to extension record
      await ext.update({ payment_id: paymentRecord.payment_id });
    }

    await addExtensionTrackingNode(reference_number, extNumber, newExpiry);

    await notifService.dispatch({
      recipient_id:     await getApplicantUserId(app.applicant_id),
      event_type:       'TIME_EXTENSION_GRANTED',
      title:            'Time Extension Granted',
      body:             `Your time extension #${extNumber} for ${reference_number} has been approved.\nNew expiry: ${new Date(newExpiry).toLocaleDateString('en-LK')}.\nFee: Rs. ${fee.toLocaleString()}`,
      reference_number,
    }).catch(e => console.error('[TIME_EXT] Notify error:', e.message));

    // Notify PSO, SW, Chairman of extension request
    setImmediate(async () => {
      try {
        const { User } = require('../models');
        const notifEvents = require('../services/notificationEvents.service');
        const chairman = await User.findOne({ where: { role: 'CHAIRMAN', status: 'ACTIVE' }, attributes: ['user_id'] });
        const swList   = await User.findAll({ where: { role: 'SW', status: 'ACTIVE' }, attributes: ['user_id'], limit: 2 });
        const psoList  = await User.findAll({ where: { role: 'PSO', status: 'ACTIVE' }, attributes: ['user_id'], limit: 2 });
        // Find the original TO who did the inspection
        const { TaskAssignment } = require('../models');
        const task = await TaskAssignment.findOne({
          where: { reference_number: referenceNumber, task_type: 'INSPECTION' },
          order: [['created_at', 'DESC']],
          attributes: ['assigned_to'],
        });

        await notifEvents.emit('TIME_EXTENSION_REQUESTED', {
          referenceNumber,
          chairmanId: chairman?.user_id,
          swId:       swList[0]?.user_id,
          psoId:      psoList[0]?.user_id,
          toId:       task?.assigned_to || null,
        });
      } catch (e) { console.error('[EXTENSION] Request notify failed:', e.message); }
    });
    return created(res, { ...ext.toJSON(), new_expiry_date: newExpiry, fee_amount: fee, payment_id: paymentRecord?.payment_id || null });
  } catch (err) { next(err); }
};

/**
 * GET /extensions/ref/:ref — all extensions for a reference number
 */
exports.getByRef = async (req, res, next) => {
  try {
    return success(res, await TimeExtension.findAll({
      where: { reference_number: req.params.ref },
      order: [['created_at', 'ASC']],
    }));
  } catch (err) { next(err); }
};

/**
 * GET /extensions/status/:status — filter by extension status
 */
exports.getByStatus = async (req, res, next) => {
  try {
    const valid = ['PENDING', 'APPROVED', 'REJECTED'];
    if (!valid.includes(req.params.status)) {
      return badRequest(res, `status must be one of: ${valid.join(', ')}`);
    }
    return success(res, await TimeExtension.findAll({ where: { status: req.params.status } }));
  } catch (err) { next(err); }
};

/**
 * GET /extensions/ref/:ref/calculate-fee — preview extension fee
 */
exports.calculateExtensionFee = async (req, res, next) => {
  try {
    const app = await getApp(req.params.ref);
    if (!app) return notFound(res, 'Application not found');
    const fee = await feeCalcService.calculateExtensionFee({ planTypeId: app.plan_type_id });
    return success(res, { fee_amount: fee, currency: 'LKR' });
  } catch (err) { next(err); }
};

/**
 * GET /extensions/ref/:ref/latest-deadline — current expiry date + extensions used
 */
exports.getLatestDeadline = async (req, res, next) => {
  try {
    const app = await getApp(req.params.ref);
    if (!app) return notFound(res, 'Application not found');
    return success(res, {
      reference_number:     req.params.ref,
      approval_date:        app.approval_date,
      current_expiry:       app.approval_expiry_date,
      extensions_used:      app.extension_count || 0,
      extensions_remaining: Math.max(0, 2 - (app.extension_count || 0)),
      status:               app.status,
    });
  } catch (err) { next(err); }
};

/**
 * PUT /extensions/:id/approve — approve a pending extension request
 */
exports.approveExtension = async (req, res, next) => {
  try {
    const ext = await TimeExtension.findByPk(req.params.id);
    if (!ext) return notFound(res, 'Extension not found');
    if (ext.status !== 'PENDING') return badRequest(res, 'Only PENDING extensions can be approved');

    const app      = await getApp(ext.reference_number);
    if (!app) return notFound(res, 'Application not found');
    if ((app.extension_count || 0) >= 2) return badRequest(res, 'Maximum extensions already granted');

    const newExpiry   = await expiryTracker.extendDeadline(app.application_id, ext.extension_years || 1);
    const extNumber   = (app.extension_count || 0) + 1;

    await app.update({ extension_count: extNumber, reminder_6month_sent: false, reminder_3month_sent: false, reminder_1month_sent: false });
    await ext.update({ status: 'APPROVED', granted_by: req.user.user_id, granted_at: new Date(), new_expiry_date: newExpiry });

    await addExtensionTrackingNode(ext.reference_number, extNumber, newExpiry);

    await notifService.dispatch({
      recipient_id:     await getApplicantUserId(app.applicant_id),
      event_type:       'TIME_EXTENSION_GRANTED',
      title:            'Time Extension Approved',
      body:             `Your time extension request for ${ext.reference_number} has been approved.\nNew expiry: ${new Date(newExpiry).toLocaleDateString('en-LK')}.`,
      reference_number: ext.reference_number,
    }).catch(() => {});

    return success(res, { ...ext.toJSON(), new_expiry_date: newExpiry }, 'Extension approved');
  } catch (err) { next(err); }
};

/**
 * PUT /extensions/:id/reject — reject a pending extension request
 */
exports.rejectExtension = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return badRequest(res, 'Rejection reason is required');

    const ext = await TimeExtension.findByPk(req.params.id);
    if (!ext) return notFound(res, 'Extension not found');
    if (ext.status !== 'PENDING') return badRequest(res, 'Only PENDING extensions can be rejected');

    await ext.update({ status: 'REJECTED', rejection_reason: reason, rejected_by: req.user.user_id, rejected_at: new Date() });

    const app = await getApp(ext.reference_number);
    if (app) {
      await notifService.dispatch({
        recipient_id:     await getApplicantUserId(app.applicant_id),
        event_type:       'TIME_EXTENSION_REJECTED',
        title:            'Time Extension Rejected',
        body:             `Your time extension request for ${ext.reference_number} has been rejected.\nReason: ${reason}\nPlease contact the Pradeshiya Sabha for further assistance.`,
        reference_number: ext.reference_number,
      }).catch(() => {});
    }

    return success(res, null, 'Extension rejected');
  } catch (err) { next(err); }
};

/**
 * PUT /extensions/:id/link-payment — link a payment record to an extension
 */
exports.linkPayment = async (req, res, next) => {
  try {
    const { payment_id } = req.body;
    if (!payment_id) return badRequest(res, 'payment_id is required');
    await TimeExtension.update({ payment_id }, { where: { extension_id: req.params.id } });
    return success(res, null, 'Payment linked to extension');
  } catch (err) { next(err); }
};

/**
 * PUT /extensions/:id/deadline — manually update expiry date (admin override)
 */
exports.updateDeadline = async (req, res, next) => {
  try {
    const { new_expiry_date } = req.body;
    if (!new_expiry_date) return badRequest(res, 'new_expiry_date is required');

    const ext = await TimeExtension.findByPk(req.params.id);
    if (!ext) return notFound(res, 'Extension not found');

    await ext.update({ new_expiry_date });
    await Application.update({ approval_expiry_date: new_expiry_date }, { where: { reference_number: ext.reference_number } });

    return success(res, { new_expiry_date }, 'Deadline updated');
  } catch (err) { next(err); }
};

/**
 * POST /extensions/:id/notify-applicant — send reminder about expiring approval
 */
exports.notifyApplicant = async (req, res, next) => {
  try {
    const ext = await TimeExtension.findByPk(req.params.id);
    if (!ext) return notFound(res, 'Extension not found');

    const app = await getApp(ext.reference_number);
    if (!app) return notFound(res, 'Application not found');

    await notifService.dispatch({
      recipient_id:     await getApplicantUserId(app.applicant_id),
      event_type:       'TIME_EXTENSION_REMINDER',
      title:            'Action Required — Approval Expiry',
      body:             req.body.message || `Your planning approval for ${ext.reference_number} is approaching its expiry date (${new Date(app.approval_expiry_date).toLocaleDateString('en-LK')}). Please apply for an extension if construction is not yet complete.`,
      reference_number: ext.reference_number,
    });

    return success(res, null, 'Applicant notified');
  } catch (err) { next(err); }
};

/**
 * GET /extensions/:id — single extension by ID
 */
exports.getById = async (req, res, next) => {
  try {
    const ext = await TimeExtension.findByPk(req.params.id);
    if (!ext) return notFound(res);
    return success(res, ext);
  } catch (err) { next(err); }
};

/**
 * GET /extensions/ref/:ref/eligibility — can this application request an extension?
 */
exports.checkExtensionEligibility = async (req, res, next) => {
  try {
    const app = await getApp(req.params.ref);
    if (!app) return notFound(res, 'Application not found');
    return success(res, {
      eligible:             (app.extension_count || 0) < 2,
      extensions_used:      app.extension_count || 0,
      extensions_remaining: Math.max(0, 2 - (app.extension_count || 0)),
      current_expiry:       app.approval_expiry_date,
    });
  } catch (err) { next(err); }
};
