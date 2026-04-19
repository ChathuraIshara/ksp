const { PCAttendee, PlanningCommitteeMeeting } = require('../models');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.addAttendee = async (req, res, next) => {
  try {
    const attendee = await PCAttendee.create({ ...req.body, meeting_id: req.params.id });
    return created(res, attendee);
  } catch (err) { next(err); }
};

exports.getByMeeting = async (req, res, next) => {
  try {
    const attendees = await PCAttendee.findAll({ where: { meeting_id: req.params.id } });
    return success(res, attendees);
  } catch (err) { next(err); }
};

exports.getByOfficer = async (req, res, next) => {
  try {
    const attendees = await PCAttendee.findAll({ where: { officer_id: req.params.officerId }, include: [{ model: PlanningCommitteeMeeting }] });
    return success(res, attendees);
  } catch (err) { next(err); }
};

exports.updateAttendanceStatus = async (req, res, next) => {
  try {
    await PCAttendee.update({ attendance_status: req.body.status }, { where: { attendee_id: req.params.attendeeId, meeting_id: req.params.id } });
    return success(res, null, 'Attendance status updated');
  } catch (err) { next(err); }
};

exports.recordAttendance = async (req, res, next) => {
  try {
    await PCAttendee.update({ attendance_status: 'ATTENDED', confirmed_at: new Date() }, { where: { attendee_id: req.params.attendeeId, meeting_id: req.params.id } });
    return success(res, null, 'Attendance recorded');
  } catch (err) { next(err); }
};

exports.verifyQuorum = async (req, res, next) => {
  try {
    const total = await PCAttendee.count({ where: { meeting_id: req.params.id } });
    const attended = await PCAttendee.count({ where: { meeting_id: req.params.id, attendance_status: 'ATTENDED' } });
    const quorumMet = total > 0 && (attended / total) >= 0.5;
    return success(res, { total, attended, quorum_met: quorumMet, quorum_required: Math.ceil(total / 2) });
  } catch (err) { next(err); }
};

exports.saveMemberNotes = async (req, res, next) => {
  try {
    await PCAttendee.update({ meeting_notes: req.body.notes }, { where: { attendee_id: req.params.attendeeId, meeting_id: req.params.id } });
    return success(res, null, 'Member notes saved');
  } catch (err) { next(err); }
};

exports.removeAttendee = async (req, res, next) => {
  try {
    await PCAttendee.destroy({ where: { attendee_id: req.params.attendeeId, meeting_id: req.params.id } });
    return success(res, null, 'Attendee removed');
  } catch (err) { next(err); }
};
