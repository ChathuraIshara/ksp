const { PlanningCommitteeMeeting, PCApplication, Application } = require('../models');
const notifService = require('../services/notification.service');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.createMeeting = async (req, res, next) => {
  try {
    const count = await PlanningCommitteeMeeting.count();
    const meeting_number = `PC-${new Date().getFullYear()}-${String(count + 1).padStart(3,'0')}`;
    const meeting = await PlanningCommitteeMeeting.create({ ...req.body, meeting_number });
    // Notify UDA officer of scheduled meeting
    setImmediate(async () => {
      try {
        const { User } = require('../models');
        const notifEvents = require('../services/notificationEvents.service');
        const udaUsers = await User.findAll({ where: { role: 'UDA', status: 'ACTIVE' }, attributes: ['user_id'], limit: 3 });
        for (const uda of udaUsers) {
          await notifEvents.emit('UDA_MEETING_SCHEDULED', {
            referenceNumber: null,
            chairmanId: uda.user_id,
          });
        }
      } catch (e) { console.error('[PC MEETING] UDA notify failed:', e.message); }
    });
    return created(res, meeting);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const meeting = await PlanningCommitteeMeeting.findByPk(req.params.id, { include: [{ model: PCApplication }] });
    if (!meeting) return notFound(res);
    return success(res, meeting);
  } catch (err) { next(err); }
};

exports.getUpcoming = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const meetings = await PlanningCommitteeMeeting.findAll({
      where: { meeting_date: { [Op.gte]: new Date() }, status: 'SCHEDULED' },
      order: [['meeting_date','ASC']],
    });
    return success(res, meetings);
  } catch (err) { next(err); }
};

exports.getCompleted = async (req, res, next) => {
  try {
    const meetings = await PlanningCommitteeMeeting.findAll({
      where: { status: 'COMPLETED' },
      order: [['meeting_date','DESC']],
    });
    return success(res, meetings);
  } catch (err) { next(err); }
};

exports.updateMeeting = async (req, res, next) => {
  try {
    const meeting = await PlanningCommitteeMeeting.findByPk(req.params.id);
    if (!meeting) return notFound(res);
    await meeting.update(req.body);
    return success(res, meeting);
  } catch (err) { next(err); }
};

exports.updateAgenda = async (req, res, next) => {
  try {
    await PlanningCommitteeMeeting.update({ agenda: req.body.agenda }, { where: { meeting_id: req.params.id } });
    return success(res, null, 'Agenda updated');
  } catch (err) { next(err); }
};

exports.addToAgenda = async (req, res, next) => {
  try {
    const { reference_number, application_id } = req.body;
    const existing = await PCApplication.findOne({ where: { meeting_id: req.params.id, application_id } });
    if (existing) return error(res, 'Application already in this meeting agenda', 409);
    const count = await PCApplication.count({ where: { meeting_id: req.params.id } });
    const pcApp = await PCApplication.create({
      meeting_id: req.params.id, application_id, reference_number,
      presentation_order: count + 1, added_by: req.user.user_id, status: 'PENDING',
    });
    return created(res, pcApp);
  } catch (err) { next(err); }
};

exports.completeMeeting = async (req, res, next) => {
  try {
    // Verify at least one decision was recorded before completing
    const { Decision } = require('../models');
    const decisionCount = await Decision.count({ where: { meeting_id: req.params.id } });
    if (decisionCount === 0) {
      return require('../utils/responseHelper').badRequest(res, 'Cannot complete a meeting with no decisions recorded.');
    }
    await PlanningCommitteeMeeting.update({ status: 'COMPLETED', completed_at: new Date() }, { where: { meeting_id: req.params.id } });
    return success(res, null, 'Meeting completed');
  } catch (err) { next(err); }
};

exports.cancelMeeting = async (req, res, next) => {
  try {
    await PlanningCommitteeMeeting.update({ status: 'CANCELLED' }, { where: { meeting_id: req.params.id } });
    return success(res, null, 'Meeting cancelled');
  } catch (err) { next(err); }
};

exports.notifyAllAttendees = async (req, res, next) => {
  try {
    const meeting = await PlanningCommitteeMeeting.findByPk(req.params.id);
    if (!meeting) return notFound(res);
    const { PCAttendee } = require('../models');
    const attendees = await PCAttendee.findAll({ where: { meeting_id: req.params.id } });
    await Promise.all(attendees.map(a =>
      notifService.dispatch({
        recipient_id: a.officer_id,
        event_type: 'MEETING_NOTIFICATION',
        title: 'PC Meeting Notification',
        body: `Planning Committee meeting ${meeting.meeting_number} is scheduled for ${meeting.meeting_date} at ${meeting.venue || 'PS Main Hall'}.`,
        channel: 'IN_APP',
      })
    ));
    return success(res, { notified: attendees.length }, 'All attendees notified');
  } catch (err) { next(err); }
};

exports.listAll = async (req, res, next) => {
  try {
    const meetings = await PlanningCommitteeMeeting.findAll({
      order: [['meeting_date', 'DESC']],
      include: [{ model: PCApplication }],
    });
    return success(res, meetings);
  } catch (err) { next(err); }
};

// ── Member Vote Recording ────────────────────────────────────────────────────
// Each committee member casts: { officer_id, vote: 'FOR'|'AGAINST'|'ABSTAIN', note }
exports.castVote = async (req, res, next) => {
  try {
    const { decision_id, officer_id, vote, note } = req.body;
    if (!decision_id || !officer_id || !vote) {
      return error(res, 'decision_id, officer_id and vote are required', 400);
    }
    if (!['FOR','AGAINST','ABSTAIN'].includes(vote)) {
      return error(res, 'vote must be FOR, AGAINST or ABSTAIN', 400);
    }
    const { Decision } = require('../models');
    const decision = await Decision.findByPk(decision_id);
    if (!decision) return notFound(res, 'Decision not found');
    if (decision.is_immutable) return error(res, 'Decision is locked', 403);

    // votes is a JSON array of { officer_id, vote, note, cast_at }
    const votes = Array.isArray(decision.votes) ? decision.votes : [];
    const existing = votes.findIndex(v => v.officer_id === officer_id);
    const entry = { officer_id, vote, note: note || '', cast_at: new Date().toISOString() };
    if (existing >= 0) votes[existing] = entry; else votes.push(entry);
    await decision.update({ votes });
    return success(res, { votes, tally: tallyVotes(votes) }, 'Vote recorded');
  } catch (err) { next(err); }
};

exports.getVoteTally = async (req, res, next) => {
  try {
    const { Decision } = require('../models');
    const decision = await Decision.findByPk(req.params.decisionId);
    if (!decision) return notFound(res, 'Decision not found');
    const votes = Array.isArray(decision.votes) ? decision.votes : [];
    return success(res, { votes, tally: tallyVotes(votes), decision_type: decision.decision_type });
  } catch (err) { next(err); }
};

// Compute majority outcome from cast votes
exports.computeMajorityOutcome = async (req, res, next) => {
  try {
    const { Decision } = require('../models');
    const decision = await Decision.findByPk(req.params.decisionId);
    if (!decision) return notFound(res, 'Decision not found');
    const votes = Array.isArray(decision.votes) ? decision.votes : [];
    const tally = tallyVotes(votes);
    const outcome = tally.FOR > tally.AGAINST ? 'MAJORITY_FOR' : tally.AGAINST > tally.FOR ? 'MAJORITY_AGAINST' : 'TIE';
    return success(res, { tally, outcome, casting_vote_required: outcome === 'TIE' });
  } catch (err) { next(err); }
};

function tallyVotes(votes) {
  return votes.reduce((acc, v) => {
    acc[v.vote] = (acc[v.vote] || 0) + 1;
    return acc;
  }, { FOR: 0, AGAINST: 0, ABSTAIN: 0 });
}

/**
 * POST /pc-meetings/:id/applications/:appId/minute
 * PDF: Every PC meeting member (PSO, TO, SW, UDA, external officers, Chairman)
 * can add their own minute on each application in the meeting agenda.
 * These minutes appear in the tracking line when the PC_MEETING node is extracted.
 */
exports.addPCMeetingMinute = async (req, res, next) => {
  try {
    const { PCApplication, Minute, Application } = require('../models');

    // Validate the application is on this meeting's agenda
    const pcApp = await PCApplication.findOne({
      where: { meeting_id: req.params.id, application_id: req.params.appId },
    });
    if (!pcApp) return notFound(res, 'Application not found on this meeting agenda');

    const app = await Application.findByPk(req.params.appId);
    if (!app) return notFound(res, 'Application not found');

    const { content, observations, recommendation } = req.body;
    const minuteContent = content || observations || recommendation;
    if (!minuteContent) return badRequest(res, 'content (or observations/recommendation) is required');

    const minute = await Minute.create({
      reference_number: app.reference_number,
      application_id:   app.application_id,
      authored_by:      req.user.user_id,
      minute_type:      'PC_MEETING',
      content:          minuteContent,
      visibility:       'OFFICERS_ONLY',
      status:           'SUBMITTED',
      submitted_at:     new Date(),
    });

    // Store minute reference on the PCApplication record
    const existingMinutes = Array.isArray(pcApp.member_minutes) ? pcApp.member_minutes : [];
    existingMinutes.push({
      minute_id:   minute.minute_id,
      authored_by: req.user.user_id,
      role:        req.user.role,
      added_at:    new Date().toISOString(),
    });
    await pcApp.update({ member_minutes: existingMinutes });

    return created(res, minute, 'PC meeting minute added');
  } catch (err) { next(err); }
};
