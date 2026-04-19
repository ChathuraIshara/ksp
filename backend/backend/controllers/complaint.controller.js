/**
 * complaint.controller.js
 *
 * Fixes applied:
 *  1. createPublicComplaint — after creation, auto-checks if there is a recently
 *     approved application for the same tax_number (within last 5 hours).
 *     If found: creates a COMPLAINT tracking node on that application's tracking
 *     line and immediately notifies SW + assigned TO + Chairman via all channels.
 *  2. Post-approval complaint reminder — a separate 30-minute cron (in
 *     reminderScheduler.js) polls for PENDING post-approval complaints.
 *     This controller just stores the required fields so the cron can find them.
 */

const { Complaint, Application, TrackingLine, TaskAssignment, User, Officer } = require('../models');
const trackingLineService = require('../services/trackingLine.service');
const notifService        = require('../services/notification.service');
const notifEvents         = require('../services/notificationEvents.service');
const { Op }              = require('sequelize');
const { success, created, notFound, badRequest, forbidden, error } = require('../utils/responseHelper');

const RESOLVE_ROLES = ['SW','TO','PSO','CHAIRMAN'];

// ── Helper: find recently approved application for a tax number ───────────────
const findPostApprovalApplication = async (taxNumber) => {
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return Application.findOne({
    where: {
      status: { [Op.in]: ['APPROVED','CONDITIONALLY_APPROVED','CERTIFICATE_READY'] },
      approval_date: { [Op.gte]: fiveHoursAgo },
    },
    include: [{
      association: 'AssessmentTaxRecord',
      where: { tax_number: taxNumber },
      required: true,
    }],
    order: [['approval_date', 'DESC']],
  });
};

// ── Helper: find the Chairman user ID ────────────────────────────────────────
const findChairmanId = async () => {
  const u = await User.findOne({ where: { role: 'CHAIRMAN', status: 'ACTIVE' } });
  return u?.user_id || null;
};

// ── Helper: find SW and TO for a reference number ────────────────────────────
const findSwAndToForRef = async (referenceNumber) => {
  const tasks = await TaskAssignment.findAll({ where: { reference_number: referenceNumber } });
  const swTask = tasks.find(t => t.task_type === 'SW_REVIEW' || t.task_type === 'SW_INITIAL');
  const toTask = tasks.find(t => t.task_type === 'TO_INSPECTION');
  return {
    sw_id: swTask?.assigned_to || null,
    to_id: toTask?.assigned_to || null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

exports.createComplaint = async (req, res, next) => {
  try {
    // Whitelist — never allow is_post_approval, chairman_id, sw_id, reminder_count
    // or complaint_id to be injected from request body
    const {
      tax_number, reference_number, complainant_name, complainant_contact,
      complainant_nic, complaint_type, description, evidence_paths,
    } = req.body;
    if (!tax_number || !complainant_name || !description) {
      return badRequest(res, 'tax_number, complainant_name and description are required');
    }
    const c = await Complaint.create({
      tax_number, reference_number, complainant_name, complainant_contact,
      complainant_nic, complaint_type, description, evidence_paths,
    });
    return created(res, c);
  } catch (err) { next(err); }
};

/**
 * POST /complaints/public  — no auth required
 *
 * After saving, checks for a recently approved application (within 5 hours).
 * If found:
 *   • Creates a COMPLAINT node on the tracking line
 *   • Stores sw_id / to_id / chairman_id on complaint row for 30-min cron
 *   • Notifies SW + TO + Chairman immediately via IN_APP + EMAIL
 */
exports.createPublicComplaint = async (req, res, next) => {
  try {
    const { tax_number, complainant_name, complainant_contact, complainant_nic, description, complaint_type } = req.body;
    if (!tax_number || !complainant_name || !description) {
      return badRequest(res, 'tax_number, complainant_name and description are required');
    }

    const chairmanId = await findChairmanId();

    // Save complaint first so the caller gets a quick response
    const c = await Complaint.create({
      tax_number, complainant_name, complainant_contact,
      complainant_nic, description, complaint_type,
      is_public:   true,
      chairman_id: chairmanId,
    });

    // ── ALWAYS notify SW + Chairman immediately for ALL public complaints ─────
    // (regardless of whether application is post-approval or not)
    setImmediate(async () => {
      try {
        const { User } = require('../models');

        // Find all active SW officers
        const swUsers = await User.findAll({
          where: { role: 'SW', status: 'ACTIVE' },
          attributes: ['user_id'],
          limit: 3,
        });

        const notifTitle = `⚠️ Public Complaint — Tax: ${tax_number}`;
        const notifBody  =
          `A public complaint has been filed.\n\n` +
          `Assessment Tax No: ${tax_number}\n` +
          `Complaint Type: ${complaint_type || 'General'}\n` +
          `Complainant: ${complainant_name}\n` +
          `Contact: ${complainant_contact || 'Not provided'}\n\n` +
          `Description: ${description}`;

        const recipients = [
          ...swUsers.map(u => ({ id: u.user_id, role: 'SW' })),
          ...(chairmanId ? [{ id: chairmanId, role: 'CHAIRMAN' }] : []),
        ];

        for (const r of recipients) {
          await notifService.dispatch({
            recipient_id:     r.id,
            event_type:       'PUBLIC_COMPLAINT_FILED',
            title:            notifTitle,
            body:             notifBody,
            reference_number: null,
            channel:          'IN_APP',
          }).catch(e => console.error(`[COMPLAINT] ${r.role} notify failed:`, e.message));
        }

        console.log(`[COMPLAINT] General complaint ${c.complaint_id} — ${recipients.length} officers notified`);
      } catch (e) {
        console.error('[COMPLAINT] General notification failed:', e.message);
      }
    });

    // ── Post-approval 5-hour check ────────────────────────────────────────────
    setImmediate(async () => {
      try {
        const recentApp = await findPostApprovalApplication(tax_number);
        if (!recentApp) return; // Not a post-approval complaint — normal path

        const refNum = recentApp.reference_number;
        const { sw_id, to_id } = await findSwAndToForRef(refNum);

        // Update complaint with linked ref + officer IDs for cron polling
        await c.update({
          reference_number: refNum,
          sw_id,
          to_id,
          is_post_approval: true,
        });

        // Create COMPLAINT node on tracking line
        const line = await TrackingLine.findOne({ where: { reference_number: refNum } });
        if (line) {
          await trackingLineService.addNode(
            line.tracking_line_id,
            refNum,
            'COMPLAINT',
            `Public Complaint — ${complaint_type || 'General'} (${new Date().toLocaleDateString('en-LK')})`,
            { linked_complaint_id: c.complaint_id },
          );
        }

        // Immediate notifications to all three — IN_APP + EMAIL
        const recipients = [
          { id: sw_id,       role: 'SW',       label: 'Superintendent of Work' },
          { id: to_id,       role: 'TO',       label: 'Technical Officer' },
          { id: chairmanId,  role: 'CHAIRMAN', label: 'Chairman' },
        ].filter(r => r.id);

        const title = `⚠ Post-Approval Complaint — ${refNum}`;
        const body  =
          `A public complaint has been filed within 5 hours of approval for application ${refNum}.\n\n` +
          `Tax Number: ${tax_number}\n` +
          `Complainant: ${complainant_name}\n` +
          `Type: ${complaint_type || 'General'}\n` +
          `Details: ${description}\n\n` +
          `This complaint requires urgent attention. Please add a minute to record your response.`;

        for (const r of recipients) {
          await notifService.dispatch({
            recipient_id:     r.id,
            event_type:       'POST_APPROVAL_COMPLAINT',
            title,
            body,
            reference_number: refNum,
          }).catch(e => console.error(`[COMPLAINT NOTIFY] ${r.role} failed:`, e.message));
        }

        console.log(`[COMPLAINT] Post-approval complaint ${c.complaint_id} linked to ${refNum}, ${recipients.length} officers notified`);
      } catch (e) {
        console.error('[COMPLAINT] Post-approval check failed:', e.message);
      }
    });

    return created(res, c, 'Complaint filed successfully');
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const c = await Complaint.findByPk(req.params.id);
    if (!c) return notFound(res);
    return success(res, c);
  } catch (err) { next(err); }
};

exports.getByTaxNumber = async (req, res, next) => {
  try {
    return success(res, await Complaint.findAll({ where: { tax_number: req.params.taxNumber } }));
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    return success(res, await Complaint.findAll({ where: { reference_number: req.params.ref } }));
  } catch (err) { next(err); }
};

exports.getByStatus = async (req, res, next) => {
  try {
    return success(res, await Complaint.findAll({ where: { status: req.params.status } }));
  } catch (err) { next(err); }
};

exports.getPending = async (req, res, next) => {
  try {
    return success(res, await Complaint.findAll({ where: { status: 'PENDING' } }));
  } catch (err) { next(err); }
};

exports.assignToOfficer = async (req, res, next) => {
  try {
    await Complaint.update(
      { assigned_to: req.body.officer_id, status: 'IN_REVIEW' },
      { where: { complaint_id: req.params.id } },
    );
    return success(res, null, 'Assigned');
  } catch (err) { next(err); }
};

exports.uploadEvidence = async (req, res, next) => {
  try {
    if (!req.file) return badRequest(res, 'No file uploaded');
    const c = await Complaint.findByPk(req.params.id);
    if (!c) return notFound(res);
    const paths = [...(c.evidence_paths || []), req.file.path];
    await c.update({ evidence_paths: paths });
    return success(res, { evidence_paths: paths });
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    await Complaint.update({ status: req.body.status }, { where: { complaint_id: req.params.id } });
    return success(res, null, 'Status updated');
  } catch (err) { next(err); }
};

exports.resolveComplaint = async (req, res, next) => {
  try {
    if (!RESOLVE_ROLES.includes(req.user.role)) {
      return forbidden(res, 'Only SW, TO, PSO or Chairman can resolve complaints');
    }
    const { resolution_note } = req.body;
    if (!resolution_note) return badRequest(res, 'Resolution note required');
    await Complaint.update({
      status:           'RESOLVED',
      resolved_by:      req.user.user_id,
      resolved_at:      new Date(),
      resolution_note,
    }, { where: { complaint_id: req.params.id } });
    return success(res, null, 'Complaint resolved');
  } catch (err) { next(err); }
};

exports.dismissComplaint = async (req, res, next) => {
  try {
    await Complaint.update({ status: 'DISMISSED' }, { where: { complaint_id: req.params.id } });
    return success(res, null, 'Complaint dismissed');
  } catch (err) { next(err); }
};

exports.sendInitialNotifications = async (req, res, next) => {
  try {
    const c = await Complaint.findByPk(req.params.id);
    if (!c) return notFound(res);
    await notifEvents.emit('COMPLAINT_FILED', {
      referenceNumber: c.reference_number || c.tax_number,
      swId:       req.body.sw_id,
      toId:       req.body.to_id,
      psoId:      req.body.pso_id,
      chairmanId: req.body.chairman_id,
    });
    return success(res, null, 'Notifications sent');
  } catch (err) { next(err); }
};

exports.sendWeeklyReminder = async (req, res, next) => {
  try {
    const c = await Complaint.findByPk(req.params.id);
    if (!c) return notFound(res);
    if (c.assigned_to) {
      await notifService.dispatch({
        recipient_id:     c.assigned_to,
        event_type:       'COMPLAINT_REMINDER',
        title:            'Complaint Reminder',
        body:             `Complaint ${c.complaint_id} on tax number ${c.tax_number} is still ${c.status}.`,
        channel:          'IN_APP',
        reference_number: c.reference_number,
      });
    }
    await c.update({ last_reminder_sent: new Date(), reminder_count: (c.reminder_count || 0) + 1 });
    return success(res, null, 'Reminder sent');
  } catch (err) { next(err); }
};

exports.checkReminderSchedule = async (req, res, next) => {
  try {
    const c = await Complaint.findByPk(req.params.id);
    if (!c) return notFound(res);
    return success(res, { last_reminder_sent: c.last_reminder_sent, reminder_count: c.reminder_count });
  } catch (err) { next(err); }
};

exports.linkResolutionMinute = async (req, res, next) => {
  try {
    await Complaint.update(
      { resolution_minute_id: req.body.minute_id },
      { where: { complaint_id: req.params.id } },
    );
    return success(res, null, 'Resolution minute linked');
  } catch (err) { next(err); }
};
