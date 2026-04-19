const { Inspection, InspectionMinute } = require('../models');
const { success, created, notFound, error } = require('../utils/responseHelper');
const offlineSyncService = require('../services/offlineSync.service');

exports.createInspection = async (req, res, next) => {
  try { return created(res, await Inspection.create({ ...req.body, officer_id: req.body.officer_id || req.user.user_id })); } catch (err) { next(err); }
};

exports.createPriorityInspection = async (req, res, next) => {
  try { return created(res, await Inspection.create({ ...req.body, inspection_type: 'COMPLAINT', priority_level: 'URGENT', officer_id: req.body.officer_id || req.user.user_id })); } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const i = await Inspection.findByPk(req.params.id, { include: [InspectionMinute] });
    if (!i) return notFound(res);
    return success(res, i);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try { return success(res, await Inspection.findAll({ where: { reference_number: req.params.ref } })); } catch (err) { next(err); }
};

exports.getByOfficer = async (req, res, next) => {
  try { return success(res, await Inspection.findAll({ where: { officer_id: req.params.officerId } })); } catch (err) { next(err); }
};

exports.scheduleInspection = async (req, res, next) => {
  try {
    const insp = await Inspection.findByPk(req.params.id);
    if (!insp) return notFound(res, 'Inspection not found');

    await Inspection.update(
      { scheduled_date: req.body.scheduled_date, status: 'SCHEDULED' },
      { where: { inspection_id: req.params.id } }
    );

    // Decrement slots_remaining on TOAvailability for the scheduled date
    if (req.body.scheduled_date && insp.officer_id) {
      const { TOAvailability } = require('../models');
      const dateOnly = req.body.scheduled_date.split('T')[0];
      const avail = await TOAvailability.findOne({
        where: { officer_id: insp.officer_id, date: dateOnly }
      });
      if (avail && avail.slots_remaining > 0) {
        await avail.update({ slots_remaining: avail.slots_remaining - 1 });
      }
    }

    // Keep application workflow consistent with scheduling action.
    // Some older rows are still ASSIGNED_TO_SW at schedule time.
    try {
      const { Application } = require('../models');
      const appService = require('../services/application.service');
      const app = await Application.findOne({
        where: insp.application_id
          ? { application_id: insp.application_id }
          : { reference_number: insp.reference_number },
        attributes: ['application_id', 'status'],
      });

      if (app) {
        if (app.status === 'ASSIGNED_TO_SW') {
          await appService.transition(app.application_id, 'ASSIGNED_TO_TO');
          await appService.transition(app.application_id, 'INSPECTION_SCHEDULED');
        } else if (app.status === 'ASSIGNED_TO_TO') {
          await appService.transition(app.application_id, 'INSPECTION_SCHEDULED');
        }
      }
    } catch (statusErr) {
      console.error('[INSPECTION] Application status update failed:', statusErr.message);
    }

    // US10: Notify applicant of scheduled inspection (IN_APP + SMS)
    setImmediate(async () => {
      try {
        const notifEvents = require('../services/notificationEvents.service');
        const { Application, Applicant } = require('../models');
        const app = insp.reference_number
          ? await Application.findOne({ where: { reference_number: insp.reference_number } })
          : null;
        if (app) {
          const applicant = await Applicant.findByPk(app.applicant_id, { attributes: ['user_id','phone'] });
          if (applicant?.user_id) {
            await notifEvents.emit('INSPECTION_SCHEDULED', {
              referenceNumber: insp.reference_number,
              applicantId:     applicant.user_id,
              applicantPhone:  applicant.phone,
              inspectionDate:  req.body.scheduled_date,
            });
          }
        }
      } catch (e) {
        console.error('[INSPECTION] Applicant notification failed:', e.message);
      }
    });

    return success(res, null, 'Inspection scheduled');
  } catch (err) { next(err); }
};

exports.rescheduleInspection = async (req, res, next) => {
  try {
    // Keep the inspection in the same scheduled bucket; only the date changes.
    await Inspection.update({ scheduled_date: req.body.scheduled_date, status: 'SCHEDULED' }, { where: { inspection_id: req.params.id } });
    return success(res, null, 'Rescheduled');
  } catch (err) { next(err); }
};

exports.confirmAttendance = async (req, res, next) => {
  try {
    await Inspection.update({ status: 'CONFIRMED' }, { where: { inspection_id: req.params.id } });
    return success(res, null, 'Attendance confirmed');
  } catch (err) { next(err); }
};

exports.completeInspection = async (req, res, next) => {
  try {
    await Inspection.update({ status: 'COMPLETED', actual_date: new Date() }, { where: { inspection_id: req.params.id } });
    return success(res, null, 'Inspection completed');
  } catch (err) { next(err); }
};

exports.cancelInspection = async (req, res, next) => {
  try {
    await Inspection.update({ status: 'CANCELLED', cancellation_reason: req.body.reason }, { where: { inspection_id: req.params.id } });
    return success(res, null, 'Inspection cancelled');
  } catch (err) { next(err); }
};

exports.saveDraftOffline = async (req, res, next) => {
  try {
    await Inspection.update({ drafted_offline: true, offline_draft_data: req.body }, { where: { inspection_id: req.params.id } });
    return success(res, null, 'Draft saved');
  } catch (err) { next(err); }
};

exports.syncOfflineDraft = async (req, res, next) => {
  try {
    await Inspection.update({ ...req.body, drafted_offline: true, synced_at: new Date() }, { where: { inspection_id: req.params.id } });
    return success(res, null, 'Offline draft synced');
  } catch (err) { next(err); }
};

// ── Inspection Slot Negotiation ───────────────────────────────────────────────
// Applicant proposes counter-slot; TO confirms or proposes again
exports.proposeCounterSlot = async (req, res, next) => {
  try {
    const { counter_date, counter_time, reason } = req.body;
    if (!counter_date || !counter_time) return error(res, 'counter_date and counter_time required', 400);
    const inspection = await Inspection.findByPk(req.params.id);
    if (!inspection) return notFound(res);
    if (!['SCHEDULED','RESCHEDULED'].includes(inspection.status)) {
      return error(res, 'Counter-slot can only be proposed on SCHEDULED or RESCHEDULED inspections', 400);
    }
    // Store negotiation history in offline_draft_data as a negotiation log
    const log = inspection.offline_draft_data?.negotiation_log || [];
    log.push({
      proposed_by: req.user.user_id,
      role: req.user.role,
      date: counter_date,
      time: counter_time,
      reason: reason || '',
      proposed_at: new Date().toISOString(),
      status: 'COUNTER_PROPOSED',
    });
    await inspection.update({
      status: 'RESCHEDULED',
      scheduled_date: new Date(`${counter_date}T00:00:00`),
      offline_draft_data: { ...inspection.offline_draft_data, negotiation_log: log, pending_counter: { date: counter_date, time: counter_time } },
    });
    // Notify TO / applicant depending on who proposed
    // Notify the other party about the counter-slot proposal
    try {
      const notifEvents = require('../services/notificationEvents.service');
      const isApplicantProposing = req.user.role === 'APPLICANT';
      await notifEvents.emit('COUNTER_SLOT_PROPOSED', {
        referenceNumber: inspection.reference_number || null,
        toId:           isApplicantProposing ? null : inspection.officer_id,
        applicantId:    isApplicantProposing ? req.user.user_id : null,
      });
    } catch (ne) { console.error('[COUNTER SLOT] Notify error:', ne.message); }
    return success(res, { inspection_id: inspection.inspection_id, negotiation_log: log }, 'Counter-slot proposed');
  } catch (err) { next(err); }
};

exports.acceptSlot = async (req, res, next) => {
  try {
    const inspection = await Inspection.findByPk(req.params.id);
    if (!inspection) return notFound(res);
    const pending = inspection.offline_draft_data?.pending_counter;
    if (!pending) return error(res, 'No pending counter-slot to accept', 400);
    const log = inspection.offline_draft_data?.negotiation_log || [];
    log.push({
      accepted_by: req.user.user_id,
      role: req.user.role,
      accepted_at: new Date().toISOString(),
      status: 'ACCEPTED',
      date: pending.date,
      time: pending.time,
    });
    await inspection.update({
      status: 'CONFIRMED',
      scheduled_date: new Date(`${pending.date}T00:00:00`),
      offline_draft_data: { ...inspection.offline_draft_data, negotiation_log: log, pending_counter: null },
    });
    return success(res, { inspection_id: inspection.inspection_id, confirmed_slot: pending, negotiation_log: log }, 'Slot accepted and confirmed');
  } catch (err) { next(err); }
};

exports.getNegotiationLog = async (req, res, next) => {
  try {
    const inspection = await Inspection.findByPk(req.params.id);
    if (!inspection) return notFound(res);
    const log = inspection.offline_draft_data?.negotiation_log || [];
    return success(res, { inspection_id: inspection.inspection_id, status: inspection.status, negotiation_log: log });
  } catch (err) { next(err); }
};
