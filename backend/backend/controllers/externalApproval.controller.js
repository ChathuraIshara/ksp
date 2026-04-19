const { ExternalApproval, Agreement } = require('../models');
const externalApprovalService = require('../services/externalApproval.service');
const swWorkflow    = require('../services/swWorkflow.service');
const notifService  = require('../services/notification.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

exports.createApproval = async (req, res, next) => {
  try {
    const fwdAt = new Date();
    const dueDate = new Date(fwdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const approval = await ExternalApproval.create({ ...req.body, forwarded_by: req.user.user_id, forwarded_at: fwdAt, due_date: dueDate });
    return created(res, approval);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    return success(res, await ExternalApproval.findAll({ where: { reference_number: req.params.ref } }));
  } catch (err) { next(err); }
};

exports.getByOfficer = async (req, res, next) => {
  try {
    const where = { officer_id: req.params.officerId };
    if (req.query.type) where.officer_type = req.query.type.toUpperCase();
    return success(res, await ExternalApproval.findAll({ where }));
  } catch (err) { next(err); }
};

// GET /external-approvals/officer/mine  — approvals assigned to the calling officer
// Frontend: listForGJS/HO/RDA call this with ?type=GJS|HO|RDA
exports.getMyApprovals = async (req, res, next) => {
  try {
    const where = { officer_id: req.user.user_id };
    if (req.query.type) where.officer_type = req.query.type.toUpperCase();
    return success(res, await ExternalApproval.findAll({
      where,
      order: [['forwarded_at', 'DESC']],
    }));
  } catch (err) { next(err); }
};

exports.getByStatus = async (req, res, next) => {
  try {
    return success(res, await ExternalApproval.findAll({ where: { approval_status: req.params.status } }));
  } catch (err) { next(err); }
};

exports.forwardToExternalOfficer = async (req, res, next) => {
  try {
    const approval = await ExternalApproval.create({
      ...req.body,
      forwarded_by:    req.user.user_id,
      forwarded_at:    new Date(),
      due_date:        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      approval_status: 'PENDING',
    });
    return created(res, approval);
  } catch (err) { next(err); }
};

// ── RDA Waiver Upload ─────────────────────────────────────────────────────────
// Per spec: RDA tracking node is NOT created until the signed waiver PDF is uploaded.
// This endpoint: (1) saves the agreement record, (2) marks waiver_uploaded on the
// ExternalApproval, (3) THEN creates the RDA tracking node.
exports.uploadRDAWaiver = async (req, res, next) => {
  try {
    const approval = await ExternalApproval.findByPk(req.params.id);
    if (!approval) return notFound(res);
    if (approval.officer_type !== 'RDA') return badRequest(res, 'This endpoint is for RDA approvals only');

    // req.file is populated by Multer (uploadHandler)
    const documentPath = req.file ? req.file.path : req.body.document_path;
    if (!documentPath) return badRequest(res, 'No waiver document provided. Upload the signed waiver PDF.');

    // Save agreement record (the signed waiver)
    await Agreement.create({
      external_approval_id: approval.approval_id,
      application_id: approval.application_id,
      reference_number: approval.reference_number,
      document_path: documentPath,
      signed_by_applicant: true,
      uploaded_by: req.user.user_id,
      uploaded_at: new Date(),
    });

    // Mark the approval as having a waiver
    await approval.update({ waiver_uploaded: true });

    // NOW create the RDA tracking node (was intentionally withheld until this point)
    const node = await swWorkflow.addRDANodeAfterWaiverUpload(approval.reference_number);

    return success(res, { approval, node }, 'RDA waiver uploaded and tracking node created');
  } catch (err) { next(err); }
};

exports.submitApproval = async (req, res, next) => {
  try {
    const approval = await ExternalApproval.findByPk(req.params.id);
    if (!approval) return notFound(res);
    // RDA: enforce waiver must be uploaded before submission
    if (approval.officer_type === 'RDA' && approval.requires_waiver) {
      const waiverUploaded = await externalApprovalService.verifyRDAWaiverUploaded(req.params.id);
      if (!waiverUploaded) return badRequest(res, 'RDA signed waiver must be uploaded before submitting approval. Use POST /:id/upload-waiver first.');
    }
    await approval.update({ approval_status: req.body.status || 'APPROVED', notes: req.body.notes });
    return success(res, approval, 'Approval submitted');
  } catch (err) { next(err); }
};

exports.linkMinute = async (req, res, next) => {
  try {
    await ExternalApproval.update({ minute_id: req.body.minute_id }, { where: { approval_id: req.params.id } });
    return success(res, null, 'Minute linked');
  } catch (err) { next(err); }
};

exports.markReturned = async (req, res, next) => {
  try {
    await ExternalApproval.update({ approval_status: 'RETURNED', returned_at: new Date(), notes: req.body.notes }, { where: { approval_id: req.params.id } });
    return success(res, null, 'Marked as returned');
  } catch (err) { next(err); }
};

exports.checkAllApprovalsComplete = async (req, res, next) => {
  try {
    const allComplete = await externalApprovalService.checkAllComplete(req.params.ref);
    return success(res, { all_complete: allComplete, reference_number: req.params.ref });
  } catch (err) { next(err); }
};

exports.notifyOfficer = async (req, res, next) => {
  try {
    const approval = await ExternalApproval.findByPk(req.params.id);
    if (!approval) return notFound(res);
    if (!approval.officer_id) return badRequest(res, 'No officer assigned to this approval');
    await notifService.dispatch({
      recipient_id: approval.officer_id,
      event_type:  'EXTERNAL_APPROVAL_ASSIGNED',
      title: 'External Approval Required',
      body: `Your assessment is required for application ${approval.reference_number} (${approval.officer_type})`,
      channel: 'IN_APP',
      reference_number: approval.reference_number,
    });
    return success(res, null, 'Officer notified');
  } catch (err) { next(err); }
};

/**
 * POST /external-approvals/:id/minute  — External officer uploads their minute document
 * Accepts multipart/form-data with a 'document' file plus text fields
 */
exports.uploadExternalMinute = async (req, res, next) => {
  try {
    const { ExternalApproval } = require('../models');
    const approval = await ExternalApproval.findByPk(req.params.id);
    if (!approval) return require('../utils/responseHelper').notFound(res, 'External approval not found');

    const filePath = req.file?.path || null;
    const minuteText = req.body.content || req.body.minute_content || req.body.recommendation || '';

    await approval.update({
      minute_content: minuteText,
      minute_document_path: filePath,
      status: 'SUBMITTED',
      submitted_at: new Date(),
    });

    return require('../utils/responseHelper').success(res, approval, 'Minute uploaded');
  } catch (err) { next(err); }
};

/**
 * POST /external-approvals/:id/submit-minute — Submit without file upload
 */
exports.submitExternalMinute = async (req, res, next) => {
  try {
    const { ExternalApproval } = require('../models');
    const approval = await ExternalApproval.findByPk(req.params.id);
    if (!approval) return require('../utils/responseHelper').notFound(res, 'External approval not found');

    await approval.update({
      minute_content: req.body.content || req.body.minute_content || req.body.recommendation || '',
      status: 'SUBMITTED',
      submitted_at: new Date(),
    });

    // Notify SW that external minute is ready
    const notifService = require('../services/notification.service');
    const { User } = require('../models');
    const swUsers = await User.findAll({ where: { role: 'SW', status: 'ACTIVE' }, attributes: ['user_id'], limit: 2 });
    await Promise.all(swUsers.map(sw =>
      notifService.dispatch({
        recipient_id: sw.user_id,
        event_type:   'EXTERNAL_MINUTE_SUBMITTED',
        title:        'External Officer Assessment Received',
        body:         `${req.user.role} has submitted their assessment for ${approval.reference_number}.`,
        reference_number: approval.reference_number,
      }).catch(() => {})
    ));

    return require('../utils/responseHelper').success(res, approval, 'Minute submitted. SW notified.');
  } catch (err) { next(err); }
};

// POST /external-approvals/:id/forward-to-sw
// SW calls this after reviewing external officer minutes to formally
// advance the application to PC_REVIEW stage for committee meeting
exports.forwardToSW = async (req, res, next) => {
  try {
    const approval = await ExternalApproval.findByPk(req.params.id);
    if (!approval) return notFound(res, 'External approval not found');

    const { Application } = require('../models');
    const app = await Application.findOne({ where: { reference_number: approval.reference_number } });
    if (!app) return notFound(res, 'Application not found');

    // Move application to PC_REVIEW once all required external approvals are in
    const { ExternalApproval: EA } = require('../models');
    const pendingApprovals = await EA.count({
      where: {
        reference_number: approval.reference_number,
        approval_status: 'PENDING',
      },
    });

    if (pendingApprovals === 0) {
      await app.update({ status: 'PC_REVIEW' });
    }

    return success(res, {
      reference_number: approval.reference_number,
      pending_approvals: pendingApprovals,
      status: pendingApprovals === 0 ? 'PC_REVIEW' : app.status,
    }, pendingApprovals === 0
      ? 'All external approvals received — application advanced to PC Review'
      : `${pendingApprovals} external approval(s) still pending`
    );
  } catch (err) { next(err); }
};
