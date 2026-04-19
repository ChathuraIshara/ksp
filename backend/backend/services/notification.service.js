/**
 * notification.service.js
 *
 * Central dispatch for ALL three channels: IN_APP, EMAIL, SMS.
 *
 * The scheduler (and any other caller) only needs to pass recipient_id +
 * event_type + title + body.  This service resolves the user's email and
 * phone from the DB itself, then fires every channel in parallel.
 *
 * Channel strategy per event_type:
 *   EXPIRY_REMINDER_6M  → IN_APP + EMAIL
 *   EXPIRY_REMINDER_3M  → IN_APP + EMAIL
 *   EXPIRY_REMINDER_1M  → IN_APP + EMAIL + SMS  (urgent)
 *   COMPLAINT_REMINDER  → IN_APP + EMAIL
 *   (everything else)   → respects the caller-supplied channel field,
 *                         but also always saves an IN_APP record
 */

const { Notification, User, Applicant, Officer } = require('../models');
const { sendEmail, sendSMS, sendPush }            = require('../utils/notificationDispatcher');

// ─── channel strategy per event type ─────────────────────────────────────────
const CHANNEL_MAP = {
  DECISION_MADE:              ['IN_APP', 'EMAIL'],
  COR_ISSUED:                 ['IN_APP', 'EMAIL'],
  EXPIRY_REMINDER_6M:  ['IN_APP', 'EMAIL'],
  EXPIRY_REMINDER_3M:  ['IN_APP', 'EMAIL'],
  EXPIRY_REMINDER_1M:  ['IN_APP', 'EMAIL', 'SMS'],
  COMPLAINT_REMINDER:         ['IN_APP', 'EMAIL'],
  POST_APPROVAL_COMPLAINT:    ['IN_APP', 'EMAIL', 'SMS'],
  TIME_EXTENSION_GRANTED:     ['IN_APP', 'EMAIL'],
  PAYMENT_CONFIRMED:          ['IN_APP', 'SMS'],
  PAYMENT_SLIP_REJECTED:      ['IN_APP', 'EMAIL'],
  BANK_SLIP_UPLOADED:         ['IN_APP'],
  QUEUE_ISSUE:                ['IN_APP', 'EMAIL', 'SMS'],
  SW_COMPLAINT_ALERT:         ['IN_APP', 'EMAIL'],
  FURTHER_REVIEW:             ['IN_APP', 'EMAIL'],
  EXPIRY_REMINDER_MANUAL:     ['IN_APP', 'EMAIL'],
  APPEAL_UPDATE:              ['IN_APP', 'EMAIL'],
  APPEAL_ASSIGNED:            ['IN_APP', 'EMAIL'],
  VOTE_CAST_EMIT:             ['IN_APP'],
};

/**
 * Resolve contact details for any user_id.
 * Looks up Users table for email, then Applicant or Officer table for phone.
 * Returns { email, phone } — either field may be null if not stored.
 */
const resolveContact = async (userId) => {
  const user = await User.findByPk(userId, { attributes: ['email', 'role'] });
  if (!user) return { email: null, phone: null };

  let phone = null;

  // Officers have their own profile row; applicants have theirs
  if (['APPLICANT'].includes(user.role)) {
    const profile = await Applicant.findOne({ where: { user_id: userId }, attributes: ['phone'] });
    phone = profile?.phone || null;
  } else {
    // PSO, SW, TO, HO, RDA, GJS, UDA, CHAIRMAN, ADMIN
    const profile = await Officer.findOne({ where: { user_id: userId }, attributes: ['phone'] });
    phone = profile?.phone || null;
  }

  return { email: user.email, phone };
};

/**
 * dispatch — send one logical notification to one recipient across all
 * appropriate channels.
 *
 * @param {object} opts
 *   recipient_id    {string}  user_id of the person to notify
 *   event_type      {string}  e.g. 'EXPIRY_REMINDER_6M'
 *   title           {string}  short subject / heading
 *   body            {string}  full message text
 *   channel         {string}  fallback channel if event_type not in CHANNEL_MAP
 *   reference_number{string}  optional — linked application ref
 *   metadata        {object}  optional extra data stored on the notification row
 */
const dispatch = async ({ recipient_id, event_type, title, body, channel, reference_number, metadata }) => {
  if (!recipient_id) {
    console.warn('[NOTIFY] dispatch called with no recipient_id — skipped', event_type);
    return null;
  }

  // Determine which channels to fire
  const channels = CHANNEL_MAP[event_type] || [channel || 'IN_APP'];

  // Resolve contact details once (shared across all channels for this send)
  const { email, phone } = await resolveContact(recipient_id);

  const results = [];

  // ── IN_APP ──────────────────────────────────────────────────────────────────
  if (channels.includes('IN_APP')) {
    const notif = await Notification.create({
      recipient_id,
      event_type,
      title,
      body,
      delivery_channel: 'IN_APP',
      delivery_status:  'SENT',
      sent_at:          new Date(),
      reference_number: reference_number || null,
      metadata:         metadata || null,
    });
    // Fire real-time push via Socket.io (best-effort — never throws)
    sendPush({
      userId:           recipient_id,
      title,
      body,
      reference_number: reference_number || null,
      event_type,
    }).catch(() => {});

    results.push(notif);
  }

  // ── EMAIL ───────────────────────────────────────────────────────────────────
  if (channels.includes('EMAIL')) {
    const notif = await Notification.create({
      recipient_id,
      event_type,
      title,
      body,
      delivery_channel: 'EMAIL',
      delivery_status:  'PENDING',
      reference_number: reference_number || null,
      metadata:         metadata || null,
    });

    if (email) {
      try {
        await sendEmail({
          to:      email,
          subject: title,
          html:    buildEmailHtml(title, body, reference_number),
          text:    body,
        });
        await notif.update({ delivery_status: 'SENT', sent_at: new Date() });
      } catch (err) {
        console.error(`[EMAIL FAILED] ${event_type} → ${email}:`, err.message);
        await notif.update({ delivery_status: 'FAILED' });
      }
    } else {
      // No email address on record — mark skipped so we know why
      await notif.update({ delivery_status: 'SKIPPED', metadata: { ...(metadata || {}), skip_reason: 'no_email' } });
    }

    results.push(notif);
  }

  // ── SMS ─────────────────────────────────────────────────────────────────────
  if (channels.includes('SMS')) {
    const notif = await Notification.create({
      recipient_id,
      event_type,
      title,
      body: truncateSMS(body),
      delivery_channel: 'SMS',
      delivery_status:  'PENDING',
      reference_number: reference_number || null,
      metadata:         metadata || null,
    });

    if (phone) {
      try {
        await sendSMS({ to: phone, message: truncateSMS(body) });
        await notif.update({ delivery_status: 'SENT', sent_at: new Date() });
      } catch (err) {
        console.error(`[SMS FAILED] ${event_type} → ${phone}:`, err.message);
        await notif.update({ delivery_status: 'FAILED' });
      }
    } else {
      await notif.update({ delivery_status: 'SKIPPED', metadata: { ...(metadata || {}), skip_reason: 'no_phone' } });
    }

    results.push(notif);
  }

  // Return the primary (IN_APP) record, or the first result
  return results[0] || null;
};

/**
 * dispatchMulti — fire multiple notifications at once.
 * Each item is a full dispatch() options object.
 */
const dispatchMulti = async (notifications) => Promise.all(notifications.map(dispatch));

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Wrap message body in a simple HTML email for readability */
const buildEmailHtml = (title, body, refNumber) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#333">
  <div style="background:#1a5276;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0">Pradeshiya Sabha</h2>
    <p  style="color:#aed6f1;margin:4px 0 0">Planning Approval System</p>
  </div>
  <div style="background:#f9f9f9;padding:24px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
    <h3 style="color:#1a5276;margin-top:0">${title}</h3>
    <p  style="line-height:1.6">${body.replace(/\n/g,'<br>')}</p>
    ${refNumber ? `<p style="background:#eaf2ff;padding:10px;border-radius:4px">Reference: <strong>${refNumber}</strong></p>` : ''}
    <hr style="border:none;border-top:1px solid #ddd;margin:20px 0">
    <p style="font-size:12px;color:#888">This is an automated message from the Pradeshiya Sabha Planning System. Please do not reply to this email.</p>
  </div>
</body>
</html>`;

/** SMS messages must be short — truncate to 160 chars */
const truncateSMS = (text) => text.length > 160 ? text.slice(0, 157) + '...' : text;

module.exports = { dispatch, dispatchMulti };
