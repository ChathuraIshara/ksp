const { Decision, Application, PlanningCommitteeMeeting, PCApplication } = require('../models');
const pcWorkflow = require('../services/pcWorkflow.service');
const lockdownService = require('../services/lockdown.service');
const trackingLineService = require('../services/trackingLine.service');
const certService = require('../services/certificate.service');
const notifService = require('../services/notification.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

exports.createDecision = async (req, res, next) => {
  try {
    // Enforce quorum: Chairman, SW, TO, and UDA Member must all be marked ATTENDED
    // This matches the workflow manual requirement for a valid collective decision
    const { PCAttendee } = require('../models');
    const REQUIRED_ROLES = ['CHAIRMAN', 'SW', 'TO', 'UDA'];

    const attendees = await PCAttendee.findAll({
      where: { meeting_id: req.body.meeting_id, attendance_status: 'ATTENDED' },
    });

    const attendedRoles = attendees.map(a => (a.role_in_meeting || '').toUpperCase());
    const missingRoles  = REQUIRED_ROLES.filter(r => !attendedRoles.some(ar => ar.includes(r)));

    if (missingRoles.length > 0) {
      return badRequest(res,
        `Quorum not met. The following required members have not been marked as ATTENDED: ${missingRoles.join(', ')}. ` +
        'All four required members (Chairman, SW, TO, UDA Member) must be present before a decision can be recorded.'
      );
    }

    const decision = await Decision.create({ ...req.body, decided_by: req.user.user_id, decided_at: new Date() });
    return created(res, decision);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const decisions = await Decision.findAll({ where: { reference_number: req.params.ref }, order: [['decided_at','DESC']] });
    return success(res, decisions);
  } catch (err) { next(err); }
};

exports.getByMeeting = async (req, res, next) => {
  try {
    const decisions = await Decision.findAll({ where: { meeting_id: req.params.meetingId } });
    return success(res, decisions);
  } catch (err) { next(err); }
};

exports.getByType = async (req, res, next) => {
  try {
    const decisions = await Decision.findAll({ where: { decision_type: req.params.type } });
    return success(res, decisions);
  } catch (err) { next(err); }
};

exports.recordVotes = async (req, res, next) => {
  try {
    await Decision.update({ votes: req.body.votes }, { where: { decision_id: req.params.id } });
    // Notify Chairman that a vote has been cast
    const decision = await Decision.findByPk(req.params.id);
    if (decision && req.body.chairman_id) {
      setImmediate(async () => {
        try {
          await notifService.dispatch({
            recipient_id:     req.body.chairman_id,
            event_type:       'VOTE_CAST_EMIT',
            title:            'Committee Vote Recorded',
            body:             `A Planning Committee vote has been recorded for application ${decision.reference_number}.`,
            reference_number: decision.reference_number,
          });
        } catch (e) { console.error('[DECISION] Vote notify error:', e.message); }
      });
    }
    return success(res, null, 'Votes recorded');
  } catch (err) { next(err); }
};

exports.documentConditions = async (req, res, next) => {
  try {
    await Decision.update({ conditions: req.body.conditions }, { where: { decision_id: req.params.id } });
    return success(res, null, 'Conditions documented');
  } catch (err) { next(err); }
};

exports.documentRejectionReason = async (req, res, next) => {
  try {
    if (!req.body.reason) return badRequest(res, 'Rejection reason is required');
    await Decision.update({ rejection_reason: req.body.reason }, { where: { decision_id: req.params.id } });
    return success(res, null, 'Rejection reason documented');
  } catch (err) { next(err); }
};

exports.documentFurtherReview = async (req, res, next) => {
  try {
    await Decision.update({ further_review_requirements: req.body.requirements }, { where: { decision_id: req.params.id } });
    return success(res, null, 'Further review requirements documented');
  } catch (err) { next(err); }
};

exports.handleFurtherReview = async (req, res, next) => {
  try {
    const decision = await Decision.findByPk(req.params.id);
    if (!decision) return notFound(res);
    await pcWorkflow.handleDecisionOutcome(req.params.id, decision.application_id, decision.reference_number, req.user.user_id);
    return success(res, null, 'Further review node created and application re-routed to SW');
  } catch (err) { next(err); }
};

exports.deferToNextMeeting = async (req, res, next) => {
  try {
    const { new_meeting_id, pc_application_id } = req.body;
    if (!new_meeting_id || !pc_application_id) return badRequest(res, 'new_meeting_id and pc_application_id required');
    await Decision.update({ decision_type: 'DEFERRED', deferred_to_meeting_id: new_meeting_id }, { where: { decision_id: req.params.id } });
    await pcWorkflow.deferToNextMeeting(pc_application_id, new_meeting_id);
    return success(res, null, 'Application deferred to next meeting');
  } catch (err) { next(err); }
};

exports.linkUDAMinute = async (req, res, next) => {
  try {
    await Decision.update({ uda_minute_id: req.body.minute_id }, { where: { decision_id: req.params.id } });
    return success(res, null, 'UDA minute linked');
  } catch (err) { next(err); }
};

exports.setApprovalFee = async (req, res, next) => {
  try {
    await Decision.update({ approval_fee_amount: req.body.amount }, { where: { decision_id: req.params.id } });
    return success(res, null, 'Approval fee set');
  } catch (err) { next(err); }
};

exports.lockDecision = async (req, res, next) => {
  try {
    await lockdownService.lockRecord(Decision, req.params.id);
    return success(res, null, 'Decision locked');
  } catch (err) { next(err); }
};

exports.notifyApplicant = async (req, res, next) => {
  try {
    const decision = await Decision.findByPk(req.params.id);
    if (!decision) return notFound(res);
    // Resolve applicant user_id from DB — never trust caller-supplied applicant_id
    const { Application, Applicant } = require('../models');
    const app = await Application.findOne({ where: { reference_number: decision.reference_number } });
    const applicant = app ? await Applicant.findByPk(app.applicant_id, { attributes: ['user_id'] }) : null;
    const userId = applicant?.user_id;
    if (!userId) return badRequest(res, 'Could not resolve applicant for notification');
    await notifService.dispatch({
      recipient_id:     userId,
      event_type:       'DECISION_MADE',
      title:            `Decision: ${decision.decision_type}`,
      body:             `A decision has been made on your application ${decision.reference_number}: ${decision.decision_type}`,
      reference_number: decision.reference_number,
    });
    await Decision.update({ applicant_notified_at: new Date() }, { where: { decision_id: req.params.id } });

    // Also emit rich APPLICATION_APPROVED event for payment prompt
    if (['APPROVED','CONDITIONALLY_APPROVED'].includes(decision.decision_type)) {
      setImmediate(async () => {
        try {
          const notifEvents = require('../services/notificationEvents.service');
          const { User, Applicant } = require('../models');
          const app = await Application.findOne({ where: { reference_number: decision.reference_number } });
          if (app) {
            const applicant = await Applicant.findByPk(app.applicant_id, { attributes: ['user_id','phone'] });
            const psoUsers = await User.findAll({ where: { role: 'PSO', status: 'ACTIVE' }, attributes: ['user_id'], limit: 2 });
            await notifEvents.emit('APPLICATION_APPROVED', {
              referenceNumber: decision.reference_number,
              applicantId:     applicant?.user_id,
              applicantPhone:  applicant?.phone,
              psoId:           psoUsers[0]?.user_id,
            });
          }
        } catch (e) { console.error('[DECISION] Approved notify failed:', e.message); }
      });
    }
    return success(res, null, 'Applicant notified');
  } catch (err) { next(err); }
};

exports.generateCertificate = async (req, res, next) => {
  try {
    const decision = await Decision.findByPk(req.params.id);
    if (!decision) return notFound(res);
    if (!['APPROVED','CONDITIONALLY_APPROVED'].includes(decision.decision_type)) {
      return badRequest(res, 'Certificate can only be generated for approved decisions');
    }
    return success(res, { message: 'Use POST /api/v1/approval-certificates/generate with this decision_id', decision_id: req.params.id });
  } catch (err) { next(err); }
};
