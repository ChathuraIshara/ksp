const { Appeal, Application, Decision } = require('../models');
const appealWorkflow = require('../services/appealWorkflow.service');
const notifService = require('../services/notification.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

exports.createAppeal = async (req, res, next) => {
  try {
    const { reference_number, original_decision_id, appeal_reason } = req.body;
    if (!appeal_reason) return badRequest(res, 'Appeal reason is required');
    const app = await Application.findOne({ where: { reference_number } });
    if (!app) return notFound(res, 'Application not found');
    const lastAppeal = await Appeal.findOne({ where: { application_id: app.application_id }, order: [['appeal_round','DESC']] });
    const appeal_round = (lastAppeal?.appeal_round || 0) + 1;
    const appeal = await Appeal.create({ ...req.body, application_id: app.application_id, appeal_round, status: 'DRAFT' });
    return created(res, appeal);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const appeals = await Appeal.findAll({ where: { reference_number: req.params.ref }, order: [['appeal_round','ASC']] });
    return success(res, appeals);
  } catch (err) { next(err); }
};

exports.getByStatus = async (req, res, next) => {
  try {
    const appeals = await Appeal.findAll({ where: { status: req.params.status } });
    return success(res, appeals);
  } catch (err) { next(err); }
};

exports.getCurrentRound = async (req, res, next) => {
  try {
    const appeal = await Appeal.findOne({ where: { reference_number: req.params.ref }, order: [['appeal_round','DESC']] });
    if (!appeal) return notFound(res, 'No appeal found for this reference');
    return success(res, { current_round: appeal.appeal_round, appeal });
  } catch (err) { next(err); }
};

exports.uploadRevisedDocuments = async (req, res, next) => {
  try {
    if (!req.files?.length) return badRequest(res, 'No files uploaded');
    const appeal = await Appeal.findByPk(req.params.id);
    if (!appeal) return notFound(res);
    const docs = [...(appeal.revised_documents || []), ...req.files.map(f => f.path)];
    await appeal.update({ revised_documents: docs });
    return success(res, { revised_documents: docs });
  } catch (err) { next(err); }
};

exports.uploadSupportingDocuments = async (req, res, next) => {
  try {
    if (!req.files?.length) return badRequest(res, 'No files uploaded');
    const appeal = await Appeal.findByPk(req.params.id);
    if (!appeal) return notFound(res);
    const docs = [...(appeal.supporting_documents || []), ...req.files.map(f => f.path)];
    await appeal.update({ supporting_documents: docs });
    return success(res, { supporting_documents: docs });
  } catch (err) { next(err); }
};

exports.submitAppeal = async (req, res, next) => {
  try {
    const appeal = await Appeal.findByPk(req.params.id);
    if (!appeal) return notFound(res);
    if (!appeal.appeal_reason) return badRequest(res, 'Appeal reason is required before submitting');

    await appeal.update({ status: 'SUBMITTED', submitted_at: new Date() });

    // Spec: "it will escalate to TO dashboard directly when submit"
    // Auto-escalate: find original TO, create TaskAssignment, create tracking nodes, update app status
    setImmediate(async () => {
      try {
        const { Application, TaskAssignment, TrackingLine, User } = require('../models');
        const trackingLineService = require('../services/trackingLine.service');
        const appealWorkflow      = require('../services/appealWorkflow.service');

        // Find the TO who handled the original inspection
        const originalTask = await TaskAssignment.findOne({
          where: { reference_number: appeal.reference_number, task_type: 'TO_INSPECTION' },
          order: [['created_at', 'ASC']],
        });

        const assignTo = originalTask?.assigned_to;

        if (assignTo) {
          // Create appeal inspection task directly in TO workload
          await TaskAssignment.create({
            reference_number: appeal.reference_number,
            application_id:   appeal.application_id,
            assigned_to:      assignTo,
            assigned_by:      appeal.application_id, // system-assigned
            task_type:        'TO_INSPECTION',
            priority:         'HIGH',
            notes:            `Appeal Round ${appeal.appeal_round} — auto-escalated on submission`,
            status:           'PENDING',
          });

          // Create appeal tracking nodes on the existing tracking line
          await appealWorkflow.createAppealNodes(
            appeal.appeal_id,
            appeal.application_id,
            appeal.reference_number,
            appeal.appeal_round
          );

          // Notify the TO
          const notifService = require('../services/notification.service');
          await notifService.dispatch({
            recipient_id:     assignTo,
            event_type:       'APPEAL_ASSIGNED',
            title:            `Appeal Round ${appeal.appeal_round} — Inspection Required`,
            body:             `An appeal (Round ${appeal.appeal_round}) for application ${appeal.reference_number} has been submitted and assigned to you for inspection.`,
            reference_number: appeal.reference_number,
          }).catch(e => console.error('[APPEAL SUBMIT] Notify TO error:', e.message));
        } else {
          // No original TO found — notify SW to assign manually
          const swList = await User.findAll({ where: { role: 'SW', status: 'ACTIVE' }, attributes: ['user_id'], limit: 1 });
          if (swList.length) {
            const notifService = require('../services/notification.service');
            await notifService.dispatch({
              recipient_id:     swList[0].user_id,
              event_type:       'APPEAL_ASSIGNED',
              title:            `Appeal Submitted — TO Assignment Required`,
              body:             `Appeal Round ${appeal.appeal_round} for ${appeal.reference_number} requires TO assignment. No original TO found.`,
              reference_number: appeal.reference_number,
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[APPEAL SUBMIT] Auto-escalation error:', e.message);
      }
    });

    return success(res, null, 'Appeal submitted and escalated to Technical Officer');
  } catch (err) { next(err); }
};

exports.linkPayment = async (req, res, next) => {
  try {
    await Appeal.update({ payment_id: req.body.payment_id }, { where: { appeal_id: req.params.id } });
    return success(res, null, 'Payment linked to appeal');
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    await Appeal.update({ status: req.body.status }, { where: { appeal_id: req.params.id } });
    return success(res, null, 'Appeal status updated');
  } catch (err) { next(err); }
};

exports.recordDecision = async (req, res, next) => {
  try {
    await Appeal.update({ decision_id: req.body.decision_id, status: 'DECIDED' }, { where: { appeal_id: req.params.id } });
    return success(res, null, 'Decision recorded on appeal');
  } catch (err) { next(err); }
};

exports.createAppealNodes = async (req, res, next) => {
  try {
    const appeal = await Appeal.findByPk(req.params.id);
    if (!appeal) return notFound(res);
    const nodes = await appealWorkflow.createAppealNodes(req.params.id, appeal.application_id, appeal.reference_number, appeal.appeal_round);
    return success(res, nodes, `Appeal Round ${appeal.appeal_round} tracking nodes created`);
  } catch (err) { next(err); }
};

exports.notifyApplicant = async (req, res, next) => {
  try {
    const appeal = await Appeal.findByPk(req.params.id);
    if (!appeal) return notFound(res);
    await notifService.dispatch({
      recipient_id: req.body.applicant_id,
      event_type: 'APPEAL_UPDATE',
      title: 'Appeal Update',
      body: `Your appeal for ${appeal.reference_number} (Round ${appeal.appeal_round}) has been updated: ${appeal.status}`,
      channel: 'IN_APP',
      reference_number: appeal.reference_number,
    });
    await appeal.update({ applicant_notified_at: new Date() });
    return success(res, null, 'Applicant notified');
  } catch (err) { next(err); }
};

exports.notifySW = async (req, res, next) => {
  try {
    const appeal = await Appeal.findByPk(req.params.id);
    if (!appeal) return notFound(res);
    await notifService.dispatch({
      recipient_id: req.body.sw_id,
      event_type: 'APPEAL_ASSIGNED',
      title: 'Appeal Requires Review',
      body: `Appeal Round ${appeal.appeal_round} for ${appeal.reference_number} requires your review.`,
      channel: 'IN_APP',
      reference_number: appeal.reference_number,
    });
    return success(res, null, 'SW notified');
  } catch (err) { next(err); }
};

/**
 * POST /appeals/:id/escalate-to-to
 * PDF spec: a submitted appeal bypasses PSO queue and goes directly to the TO workload.
 * Creates a TaskAssignment for the TO who handled the original application.
 */
exports.escalateToTO = async (req, res, next) => {
  try {
    const { TaskAssignment, Application } = require('../models');
    const appeal = await Appeal.findByPk(req.params.id);
    if (!appeal) return notFound(res, 'Appeal not found');
    if (appeal.status !== 'SUBMITTED') return badRequest(res, 'Appeal must be SUBMITTED before escalating');

    // Find the original TO for this application (last TO_INSPECTION task)
    const originalTask = await TaskAssignment.findOne({
      where: { reference_number: appeal.reference_number, task_type: 'TO_INSPECTION' },
      order: [['created_at', 'DESC']],
    });

    const assignTo = req.body.to_officer_id || originalTask?.assigned_to;
    if (!assignTo) return badRequest(res, 'to_officer_id is required — no original TO found for this application');

    // Create appeal inspection task for the TO
    const task = await TaskAssignment.create({
      reference_number: appeal.reference_number,
      application_id:   appeal.application_id,
      assigned_to:      assignTo,
      assigned_by:      req.user.user_id,
      task_type:        'TO_INSPECTION',
      priority:         'HIGH',
      notes:            `Appeal Round ${appeal.appeal_round} — direct escalation to TO`,
      status:           'PENDING',
    });

    await appeal.update({ status: 'UNDER_REVIEW' });

    // Update application status to reflect appeal under review
    await Application.update(
      { status: 'APPEAL_IN_REVIEW' },
      { where: { reference_number: appeal.reference_number } }
    );

    // Notify the TO
    await notifService.dispatch({
      recipient_id:     assignTo,
      event_type:       'APPEAL_ASSIGNED',
      title:            `Appeal Round ${appeal.appeal_round} — Inspection Required`,
      body:             `An appeal for application ${appeal.reference_number} (Round ${appeal.appeal_round}) has been assigned to you for inspection.`,
      reference_number: appeal.reference_number,
    }).catch(e => console.error('[APPEAL ESCALATE] Notify TO error:', e.message));

    return success(res, { task_id: task.task_id, assigned_to: assignTo }, 'Appeal escalated to TO workload');
  } catch (err) { next(err); }
};
