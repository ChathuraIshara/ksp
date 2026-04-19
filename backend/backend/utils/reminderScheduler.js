/**
 * reminderScheduler.js  — all cron jobs
 *
 * Cron jobs:
 *  1. Daily 00:00  — update expiry flags
 *  2. Daily 08:00  — 6-month expiry reminders
 *  3. Daily 08:01  — 3-month expiry reminders
 *  4. Daily 08:02  — 1-month expiry reminders (+ SMS)
 *  5. Monday 08:00 — weekly complaint reminders
 *  6. Every 30 min — post-approval complaint urgent reminders (NEW)
 */

const cron           = require('node-cron');
const reminderService = require('../services/reminderScheduler.service');
const { Complaint }  = require('../models');
const notifService   = require('../services/notification.service');
const { Op }         = require('sequelize');

// ── Cron 6: Every 30 minutes — post-approval complaint reminders ──────────────
const sendPostApprovalComplaintReminders = async () => {
  try {
    // Find complaints that are: post-approval, still PENDING/IN_REVIEW,
    // have no resolution minute yet, and were last reminded > 25 min ago
    const cutoff = new Date(Date.now() - 25 * 60 * 1000);
    const complaints = await Complaint.findAll({
      where: {
        is_post_approval: true,
        status: { [Op.in]: ['PENDING', 'IN_REVIEW'] },
        resolution_minute_id: null,
        [Op.or]: [
          { last_reminder_sent: null },
          { last_reminder_sent: { [Op.lt]: cutoff } },
        ],
      },
    });

    if (complaints.length === 0) return;
    console.log(`[CRON-30MIN] ${complaints.length} post-approval complaint(s) need reminders`);

    for (const c of complaints) {
      const recipientIds = [c.sw_id, c.to_id, c.chairman_id].filter(Boolean);
      const uniqueIds    = [...new Set(recipientIds.map(String))];
      const count        = (c.reminder_count || 0) + 1;

      const title = `🔴 URGENT: Unresolved Post-Approval Complaint — ${c.reference_number || c.tax_number}`;
      const body  =
        `This is reminder #${count} for complaint ${c.complaint_id}.\n\n` +
        `Tax Number: ${c.tax_number}\n` +
        `Reference: ${c.reference_number || 'Not linked'}\n` +
        `Status: ${c.status}\n` +
        `Complainant: ${c.complainant_name}\n\n` +
        `This complaint is unresolved. Please log in and add a minute to record your response. ` +
        `Reminders will continue every 30 minutes until actioned.\n\n` +
        `— Pradeshiya Sabha Planning System`;

      await Promise.all(
        uniqueIds.map(recipientId =>
          notifService.dispatch({
            recipient_id:     recipientId,
            event_type:       'POST_APPROVAL_COMPLAINT',
            title,
            body,
            reference_number: c.reference_number || null,
          }).catch(e => console.error(`[CRON-30MIN] notify failed for ${recipientId}:`, e.message))
        )
      );

      await c.update({
        last_reminder_sent: new Date(),
        reminder_count:     count,
      });
    }
  } catch (e) {
    console.error('[CRON-30MIN] Post-approval complaint reminders error:', e.message);
  }
};

// Purge stale/expired OTPs every 15 minutes
const purgeExpiredOTPs = async () => {
  try {
    const { OTP } = require('../models');
    const { Op } = require('sequelize');
    const deleted = await OTP.destroy({ where: { expires_at: { [Op.lt]: new Date() } } });
    if (deleted > 0) console.log(`[OTP PURGE] Removed ${deleted} expired OTP record(s)`);
  } catch (e) { console.error('[OTP PURGE] Error:', e.message); }
};

const start = () => {
  // Cron 1: Daily 00:00 — update expiry flags
  cron.schedule('0 0 * * *', () => {
    console.log('[CRON] Updating expiry flags...');
    reminderService.updateExpiryFlags();
  });

  // Cron 2: Daily 08:00 — 6-month reminders
  cron.schedule('0 8 * * *', () => {
    console.log('[CRON] Sending 6-month expiry reminders...');
    reminderService.send6MonthReminders();
  });

  // Cron 3: Daily 08:01 — 3-month reminders
  cron.schedule('1 8 * * *', () => {
    console.log('[CRON] Sending 3-month expiry reminders...');
    reminderService.send3MonthReminders();
  });

  // Cron 4: Daily 08:02 — 1-month reminders (IN_APP + EMAIL + SMS)
  cron.schedule('2 8 * * *', () => {
    console.log('[CRON] Sending 1-month expiry reminders...');
    reminderService.send1MonthReminders();
  });

  // Cron 5: Monday 08:00 — weekly complaint reminders
  cron.schedule('0 8 * * 1', () => {
    console.log('[CRON] Sending weekly complaint reminders...');
    reminderService.sendWeeklyComplaintReminders();
  });

  // Cron 6: Every 30 minutes — post-approval urgent complaint reminders
  cron.schedule('*/30 * * * *', () => {
    console.log('[CRON] Checking post-approval complaint reminders...');
    sendPostApprovalComplaintReminders();
  });

  // Cron 7: Every 15 minutes — purge expired OTP rows
  cron.schedule('*/15 * * * *', purgeExpiredOTPs);

  console.log('[CRON] All 7 cron jobs scheduled.');
};

module.exports = { start };
