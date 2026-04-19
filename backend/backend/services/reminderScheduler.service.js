/**
 * reminderScheduler.service.js
 *
 * All 5 cron job handlers.
 *
 * Each reminder now fires ALL THREE channels automatically — the notification
 * service resolves the user's email + phone from the DB and dispatches
 * IN_APP + EMAIL (and SMS for urgent reminders) without the scheduler needing
 * to know anything about contact details.
 */

const { Application, Complaint, User, Applicant } = require('../models');
const expiryTracker = require('./expiryTracker.service');
const notifService  = require('./notification.service');
const { Op }        = require('sequelize');

// ─── Helper: resolve user_id from applicant_id ───────────────────────────────
const getApplicantUserId = async (applicantId) => {
  if (!applicantId) return null;
  const applicant = await Applicant.findByPk(applicantId, { attributes: ['user_id'] });
  return applicant?.user_id || null;
};

// ─── Cron 1: Update expiry flags ──────────────────────────────────────────────
const updateExpiryFlags = async () => {
  try {
    await expiryTracker.updateExpiryFlags();
  } catch (e) {
    console.error('[CRON] Expiry flag error:', e.message);
  }
};

// ─── Cron 2: 6-month reminders → IN_APP + EMAIL ───────────────────────────────
const send6MonthReminders = async () => {
  const apps = await expiryTracker.getAppsForReminder(6, 'reminder_6month_sent');
  console.log(`[CRON] 6-month reminders: ${apps.length} application(s)`);

  for (const app of apps) {
    try {
      const userId = await getApplicantUserId(app.applicant_id);
      if (!userId) { console.warn(`[CRON] No user_id for applicant ${app.applicant_id}, skipping`); continue; }
      await notifService.dispatch({
        recipient_id:     userId,
        event_type:       'EXPIRY_REMINDER_6M',       // → IN_APP + EMAIL
        title:            'Planning Approval Expiry — 6 Months Remaining',
        body:
          `Dear Applicant,\n\n` +
          `Your building planning approval (Ref: ${app.reference_number}) will expire in approximately 6 months.\n\n` +
          `If construction is not yet complete, please apply for a time extension before the expiry date to avoid penalties.\n\n` +
          `Log in to the Pradeshiya Sabha portal to apply for an extension or check your application status.\n\n` +
          `— Pradeshiya Sabha Planning Division`,
        reference_number: app.reference_number,
      });
      await app.update({ reminder_6month_sent: true });
    } catch (e) {
      console.error(`[CRON] 6M reminder failed for ${app.reference_number}:`, e.message);
    }
  }
};

// ─── Cron 3: 3-month reminders → IN_APP + EMAIL ───────────────────────────────
const send3MonthReminders = async () => {
  const apps = await expiryTracker.getAppsForReminder(3, 'reminder_3month_sent');
  console.log(`[CRON] 3-month reminders: ${apps.length} application(s)`);

  for (const app of apps) {
    try {
      const userId = await getApplicantUserId(app.applicant_id);
      if (!userId) { console.warn(`[CRON] No user_id for applicant ${app.applicant_id}, skipping`); continue; }
      await notifService.dispatch({
        recipient_id:     userId,
        event_type:       'EXPIRY_REMINDER_3M',       // → IN_APP + EMAIL
        title:            'Planning Approval Expiry — 3 Months Remaining',
        body:
          `Dear Applicant,\n\n` +
          `Your building planning approval (Ref: ${app.reference_number}) will expire in 3 months.\n\n` +
          `Please take immediate steps to apply for a time extension if construction is still in progress. ` +
          `Extensions must be approved before expiry — late applications attract additional fees.\n\n` +
          `Log in to the Pradeshiya Sabha portal to apply.\n\n` +
          `— Pradeshiya Sabha Planning Division`,
        reference_number: app.reference_number,
      });
      await app.update({ reminder_3month_sent: true });
    } catch (e) {
      console.error(`[CRON] 3M reminder failed for ${app.reference_number}:`, e.message);
    }
  }
};

// ─── Cron 4: 1-month reminders → IN_APP + EMAIL + SMS ────────────────────────
const send1MonthReminders = async () => {
  const apps = await expiryTracker.getAppsForReminder(1, 'reminder_1month_sent');
  console.log(`[CRON] 1-month reminders: ${apps.length} application(s)`);

  for (const app of apps) {
    try {
      const userId = await getApplicantUserId(app.applicant_id);
      if (!userId) { console.warn(`[CRON] No user_id for applicant ${app.applicant_id}, skipping`); continue; }
      await notifService.dispatch({
        recipient_id:     userId,
        event_type:       'EXPIRY_REMINDER_1M',       // → IN_APP + EMAIL + SMS
        title:            '⚠ URGENT: Planning Approval Expires in 1 Month',
        body:
          `URGENT — Pradeshiya Sabha\n\n` +
          `Your planning approval (Ref: ${app.reference_number}) expires in 1 MONTH.\n\n` +
          `Apply for a time extension IMMEDIATELY at the Pradeshiya Sabha office or through the online portal. ` +
          `Failure to extend before expiry will result in your approval lapsing and you will need to reapply.\n\n` +
          `Contact us immediately if you need assistance.\n\n` +
          `— Pradeshiya Sabha Planning Division`,
        reference_number: app.reference_number,
      });
      await app.update({ reminder_1month_sent: true });
    } catch (e) {
      console.error(`[CRON] 1M reminder failed for ${app.reference_number}:`, e.message);
    }
  }
};

// ─── Cron 5: Weekly complaint reminders → IN_APP + EMAIL (all 4 officers) ─────
const sendWeeklyComplaintReminders = async () => {
  const complaints = await Complaint.findAll({
    where: { status: { [Op.in]: ['PENDING', 'IN_REVIEW'] } },
  });
  console.log(`[CRON] Weekly complaint reminders: ${complaints.length} open complaint(s)`);

  for (const c of complaints) {
    // All 4 responsible officers — deduped, nulls removed
    const recipientIds = [
      c.assigned_to,
      c.sw_id,
      c.to_id,
      c.pso_id,
      c.chairman_id,
    ].filter(Boolean);

    const uniqueIds = [...new Set(recipientIds.map(String))];

    const title = 'Pending Complaint — Action Required';
    const body  =
      `This is a weekly reminder that complaint ${c.complaint_id} ` +
      `on tax number ${c.tax_number} remains ${c.status}.\n\n` +
      `${c.reference_number ? `Linked application: ${c.reference_number}\n\n` : ''}` +
      `Please review this complaint and take action or document your response with a minute. ` +
      `Unresolved complaints are escalated to the Chairman after 4 weeks.\n\n` +
      `— Pradeshiya Sabha Planning System`;

    // Fire IN_APP + EMAIL to every officer in parallel
    await Promise.all(
      uniqueIds.map(recipientId =>
        notifService.dispatch({
          recipient_id:     recipientId,
          event_type:       'COMPLAINT_REMINDER',     // → IN_APP + EMAIL
          title,
          body,
          reference_number: c.reference_number || null,
        }).catch(e => console.error(`[CRON] Complaint reminder failed for ${recipientId}:`, e.message))
      )
    );

    await c.update({
      reminder_count:    (c.reminder_count || 0) + 1,
      last_reminder_sent: new Date(),
    });
  }
};

module.exports = {
  updateExpiryFlags,
  send6MonthReminders,
  send3MonthReminders,
  send1MonthReminders,
  sendWeeklyComplaintReminders,
};
