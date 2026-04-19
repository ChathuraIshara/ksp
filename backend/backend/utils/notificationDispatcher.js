/**
 * notificationDispatcher.js
 *
 * Low-level transport layer for all three channels:
 *   sendEmail({ to, subject, html, text })
 *   sendSMS({ to, message })
 *   sendPush({ userId, title, body })     ← real-time via Socket.io
 *
 * SMS provider selection via SMS_PROVIDER env var:
 *   notify_lk  — Notify.lk (most common in Sri Lanka)
 *   sms_lk     — SMS.lk
 *   dialog     — Dialog Axiata Business SMS
 *   generic    — Generic REST { to, message, sender } (default)
 *
 * Each function silently skips if the service is not configured.
 */

const nodemailer = require('nodemailer');
const env        = require('../config/env');

// ─── EMAIL ────────────────────────────────────────────────────────────────────
let _transporter = null;

const getTransporter = () => {
  if (!env.email.host || !env.email.user) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   env.email.host,
      port:   env.email.port || 587,
      secure: env.email.port === 465,
      auth: {
        user: env.email.user,
        pass: env.email.pass,
      },
    });
  }
  return _transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    console.log(`[EMAIL SKIPPED — SMTP not configured] To: ${to} | ${subject}`);
    return { skipped: true };
  }
  try {
    return await t.sendMail({
      from:    env.email.from || 'noreply@pradeshiyasabha.lk',
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error(`[EMAIL FAILED] ${to}: ${err.message}`);
    throw err;
  }
};

// ─── SMS ──────────────────────────────────────────────────────────────────────
/**
 * SMS provider request builders.
 * Add new providers here without changing any other file.
 */
const SMS_PROVIDERS = {
  /**
   * Notify.lk  — https://www.notify.lk/
   * POST https://app.notify.lk/api/v1/send
   * Headers: { user_id, api_key }
   * Body:    { user_id, api_key, sender_id, to, message }
   */
  notify_lk: (to, message) => ({
    url:     env.sms.apiUrl || 'https://app.notify.lk/api/v1/send',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id:   env.sms.userId,
      api_key:   env.sms.apiKey,
      sender_id: env.sms.sender || 'NotifyDEMO',
      to,
      message,
    }),
  }),

  /**
   * SMS.lk  — https://www.sms.lk/
   * POST https://www.sms.lk/api/v3/sms/send
   * Headers: { Authorization: Bearer <token> }
   * Body:    { recipient, sender_id, message }
   */
  sms_lk: (to, message) => ({
    url:     env.sms.apiUrl || 'https://www.sms.lk/api/v3/sms/send',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${env.sms.apiKey}`,
    },
    body: JSON.stringify({
      recipient:  to,
      sender_id:  env.sms.sender || 'PSABHA',
      message,
    }),
  }),

  /**
   * Dialog Axiata Business SMS
   * POST https://api.dialog.lk/sms/send
   * Headers: { Authorization: Bearer <key>, x-ibm-client-id }
   * Body:    { to, message, from }
   */
  dialog: (to, message) => ({
    url:     env.sms.apiUrl || 'https://api.dialog.lk/sms/send',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${env.sms.apiKey}`,
      'x-ibm-client-id': env.sms.clientId || '',
    },
    body: JSON.stringify({
      to,
      message,
      from: env.sms.sender || 'PSABHA',
    }),
  }),

  /**
   * Generic — works with most REST SMS gateways
   * POST <SMS_API_URL>
   * Headers: { Authorization: Bearer <key> }
   * Body:    { to, message, sender }
   */
  generic: (to, message) => ({
    url:     env.sms.apiUrl,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${env.sms.apiKey}`,
    },
    body: JSON.stringify({
      to,
      message,
      sender: env.sms.sender || 'PSABHA',
    }),
  }),
};

const sendSMS = async ({ to, message }) => {
  if (!env.sms.apiKey) {
    console.log(`[SMS SKIPPED — not configured] To: ${to} | ${message.slice(0, 40)}`);
    return { skipped: true };
  }

  const phone    = normaliseLKPhone(to);
  const provider = (process.env.SMS_PROVIDER || 'generic').toLowerCase();
  const builder  = SMS_PROVIDERS[provider] || SMS_PROVIDERS.generic;
  const req      = builder(phone, message);

  if (!req.url) {
    console.log(`[SMS SKIPPED — SMS_API_URL not set] To: ${phone}`);
    return { skipped: true };
  }

  try {
    const response = await fetch(req.url, {
      method:  'POST',
      headers: req.headers,
      body:    req.body,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SMS gateway ${response.status}: ${errText}`);
    }

    return await response.json().catch(() => ({ ok: true }));
  } catch (err) {
    console.error(`[SMS FAILED] ${phone}: ${err.message}`);
    throw err;
  }
};

// ─── REAL-TIME PUSH via Socket.io ─────────────────────────────────────────────
/**
 * sendPush — emits a real-time in-app push to a specific user's Socket.io room.
 * The Socket.io server is attached to the HTTP server in app.js.
 * Each authenticated socket joins a room named after their user_id.
 *
 * If Socket.io is not yet connected (e.g. during startup) the call is silently skipped.
 */
const sendPush = async ({ userId, title, body, reference_number, event_type }) => {
  try {
    const io = require('../utils/socketServer').getIO();
    if (!io) {
      console.log(`[PUSH SKIPPED — Socket.io not ready] User: ${userId}`);
      return { skipped: true };
    }
    io.to(`user:${userId}`).emit('notification', {
      title,
      body,
      reference_number: reference_number || null,
      event_type:       event_type       || 'GENERAL',
      received_at:      new Date().toISOString(),
    });
    return { sent: true };
  } catch (err) {
    console.error(`[PUSH FAILED] User ${userId}: ${err.message}`);
    return { skipped: true };
  }
};

// ─── helpers ──────────────────────────────────────────────────────────────────
/**
 * Normalise Sri Lanka phone numbers to E.164 (+94XXXXXXXXX).
 * Handles: 07XXXXXXXX  7XXXXXXXX  +947XXXXXXXX  0094XXXXXXXXX
 */
const normaliseLKPhone = (raw) => {
  if (!raw) return raw;
  const digits = String(raw).replace(/[\s\-()]/g, '');
  if (digits.startsWith('+94'))  return digits;
  if (digits.startsWith('0094')) return '+' + digits.slice(2);
  if (digits.startsWith('0'))    return '+94' + digits.slice(1);
  if (digits.startsWith('94'))   return '+' + digits;
  return '+94' + digits;
};

module.exports = { sendEmail, sendSMS, sendPush };
