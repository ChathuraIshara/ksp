const { PSOVerificationLog, Application, Applicant, User } = require('../models');
const queueService  = require('../services/queueManagement.service');
const notifEvents   = require('../services/notificationEvents.service');
const notifService  = require('../services/notification.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

exports.createLog = async (req, res, next) => {
  try {
    const log = await PSOVerificationLog.create({ ...req.body, pso_id: req.user.user_id });
    return created(res, log);
  } catch (err) { next(err); }
};

exports.performVerification = async (req, res, next) => {
  try {
    const { reference_number, application_id, tax_number_checked, name_match_result,
            doc_completeness_result, complaint_flag, issue_note, verification_note } = req.body;
    const normalizedNameMatchResult = name_match_result === 'MATCH' ? 'MATCHED' : name_match_result;

    let action_taken = 'VERIFIED';
    if (doc_completeness_result === 'INCOMPLETE') action_taken = 'DOCUMENT_ISSUE';
    else if (name_match_result === 'MISMATCH')    action_taken = 'NAME_MISMATCH';
    else if (complaint_flag)                      action_taken = 'COMPLAINT';

    // Enforce: for non-WALK_IN applications, PSO must confirm 3 physical copies present
    const { Application } = require('../models');
    const app = await Application.findByPk(application_id);
    const publicReferenceNumber = reference_number || app?.reference_number || null;
    const logReferenceNumber = publicReferenceNumber || `APP-${application_id}`;
    if (app && app.submission_mode !== 'WALK_IN') {
      const { physical_copies_count } = req.body;
      if (!physical_copies_count || Number(physical_copies_count) < 3) {
        return badRequest(res,
          'physical_copies_count must be 3 or more. ' +
          'PSO must confirm all 3 physical plan copies are present before queue assignment.'
        );
      }
      await app.update({
        physical_copies_count: Number(physical_copies_count),
        physical_copies_confirmed: true,
        physical_copies_confirmed_by: req.user.user_id,
      });
    }

    // Enforce: PSO must provide a descriptive note before routing to any issue queue
    if (['DOCUMENT_ISSUE','NAME_MISMATCH'].includes(action_taken)) {
      const note = issue_note || verification_note;
      if (!note || note.trim().length < 10) {
        return badRequest(res,
          'A descriptive note (minimum 10 characters) is required when routing to a ' +
          action_taken.replace('_',' ').toLowerCase() + ' queue. ' +
          'This note will be sent to the applicant explaining the issue.'
        );
      }
    }

    const log = await PSOVerificationLog.create({
      reference_number: logReferenceNumber, application_id, pso_id: req.user.user_id,
      tax_number_checked, name_match_result: normalizedNameMatchResult, doc_completeness_result,
      complaint_flag, action_taken,
      verification_note: issue_note || verification_note || null,
    });

    await queueService.routeToQueue(application_id, logReferenceNumber, action_taken, req.user.user_id);

    // Keep application status aligned with PSO outcome so SW dashboard queries work.
    if (application_id) {
      if (action_taken === 'VERIFIED' || action_taken === 'COMPLAINT') {
        await Application.update(
          { status: 'ASSIGNED_TO_SW' },
          { where: { application_id } }
        );
      } else if (action_taken === 'DOCUMENT_ISSUE' || action_taken === 'NAME_MISMATCH') {
        await Application.update(
          { status: 'PSO_REVIEW' },
          { where: { application_id } }
        );
      }
    }

    // Set has_document_issue_notification so applicant's Edit button becomes active
    if (action_taken === 'DOCUMENT_ISSUE' && application_id) {
      await Application.update(
        { has_document_issue_notification: true },
        { where: { application_id } }
      );
    }

    // ── Notify applicant when there is an issue (Doc or Name mismatch) ─────────
    if (['DOCUMENT_ISSUE', 'NAME_MISMATCH'].includes(action_taken)) {
      setImmediate(async () => {
        try {
          const app        = await Application.findByPk(application_id);
          const applicant  = app ? await Applicant.findByPk(app.applicant_id, { attributes: ['user_id'] }) : null;
          const userId     = applicant?.user_id;
          if (userId) {
            // Get the note from the queue assignment
            const issueLabel = action_taken === 'DOCUMENT_ISSUE' ? 'Document Issue' : 'Assessment Name Mismatch';
            await notifService.dispatch({
              recipient_id:     userId,
              event_type:       'QUEUE_ISSUE',
              title:            `Action Required: ${issueLabel}`,
              body:             `The Pradeshiya Sabha has reviewed your application and found an issue: ${issueLabel}.\n\n` +
                                `PSO Note: ${req.body.issue_note || 'Please contact the Pradeshiya Sabha office for details.'}\n\n` +
                                `Please correct the issue and resubmit. Log in to the portal for more details.`,
              reference_number: publicReferenceNumber || logReferenceNumber,
            });
          }
        } catch (e) { console.error('[PSO VERIFY] Applicant notify error:', e.message); }
      });
    }

    // ── Notify SW when complaint queue assigned + auto-create priority inspection ─
    if (action_taken === 'COMPLAINT') {
      setImmediate(async () => {
        try {
          const swUsers = await User.findAll({ where: { role: 'SW', status: 'ACTIVE' }, attributes: ['user_id'], limit: 3 });
          await Promise.all(swUsers.map(sw =>
            notifService.dispatch({
              recipient_id:     sw.user_id,
              event_type:       'SW_COMPLAINT_ALERT',
              title:            'Complaint Application — Priority Inspection Required',
              body:             `An application (Ref: ${publicReferenceNumber || 'Pending'}) has been placed in the complaint queue.\n\n` +
                                `Tax Number: ${tax_number_checked}\n` +
                                `Active complaints exist for this assessment tax number. ` +
                                `A PRIORITY inspection request has been auto-created. ` +
                                `Please assign a Technical Officer immediately.`,
              reference_number: publicReferenceNumber || logReferenceNumber,
            }).catch(e => console.error('[PSO VERIFY] SW notify error:', e.message))
          ));

          // Auto-create a priority inspection record flagged as URGENT
          // so SW sees it immediately in their queue without manual creation
          if (application_id) {
            const { Inspection } = require('../models');
            await Inspection.create({
              application_id,
              reference_number: publicReferenceNumber,
              inspection_type:  'COMPLAINT',
              priority_level:   'URGENT',
              officer_id:       req.user.user_id, // PSO as initiator — SW will reassign TO
              status:           'SCHEDULED',
              notes:            `Auto-created priority inspection due to active complaints on tax number ${tax_number_checked}`,
            });
          }
        } catch (e) { console.error('[PSO VERIFY] SW notify/inspection error:', e.message); }
      });
    }

    return created(res, { log, action_taken });
  } catch (err) { next(err); }
};

exports.updateNameMatchResult = async (req, res, next) => {
  try {
    const normalizedResult = req.body.result === 'MATCH' ? 'MATCHED' : req.body.result;
    await PSOVerificationLog.update({ name_match_result: normalizedResult }, { where: { log_id: req.params.id } });
    return success(res, null, 'Name match result updated');
  } catch (err) { next(err); }
};

exports.updateDocumentCheckResult = async (req, res, next) => {
  try {
    await PSOVerificationLog.update({ doc_completeness_result: req.body.result }, { where: { log_id: req.params.id } });
    return success(res, null, 'Document check result updated');
  } catch (err) { next(err); }
};

exports.setComplaintFlag = async (req, res, next) => {
  try {
    await PSOVerificationLog.update({ complaint_flag: req.body.flag }, { where: { log_id: req.params.id } });
    return success(res, null, 'Complaint flag set');
  } catch (err) { next(err); }
};

exports.recordActionTaken = async (req, res, next) => {
  try {
    const { action, note } = req.body;
    await PSOVerificationLog.update({ action_taken: action, verification_note: note }, { where: { log_id: req.params.id } });
    return success(res, null, 'Action recorded');
  } catch (err) { next(err); }
};

exports.flagComplaint = async (req, res, next) => {
  try {
    await PSOVerificationLog.update({ complaint_flag: true, action_taken: 'COMPLAINT' }, { where: { log_id: req.params.id } });
    return success(res, null, 'Flagged as complaint');
  } catch (err) { next(err); }
};

exports.getLogsByRef = async (req, res, next) => {
  try {
    const logs = await PSOVerificationLog.findAll({ where: { reference_number: req.params.ref }, order: [['created_at','DESC']] });
    return success(res, logs);
  } catch (err) { next(err); }
};
