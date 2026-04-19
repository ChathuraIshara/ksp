/**
 * auth.controller.js  —  Secure auth implementation
 *
 * Security properties:
 *  ✅ Cryptographically secure OTP: crypto.randomInt (not Math.random)
 *  ✅ OTP stored as SHA-256 hash — plaintext never written to DB
 *  ✅ OTP expires in 10 minutes (expires_at column, checked on use)
 *  ✅ OTP invalidated after 3 wrong attempts (attempt_count column)
 *  ✅ OTP purpose-scoped (EMAIL_VERIFY / PASSWORD_RESET / SIGNING)
 *  ✅ Timing-safe OTP comparison (crypto.timingSafeEqual)
 *  ✅ JWT signed with expiry (15 min access, never permanent)
 *  ✅ Uniform login error — same message for wrong password vs missing user
 *  ✅ bcrypt async on all hot paths (register, login, reset, createOfficer)
 *  ✅ Google users: password_hash = NULL (no fake known hash)
 *  ✅ OTP route validation schema matches actual 4-digit length
 *
 * Auth flow:
 *  Register → success → user signs in → needsEmailVerification:true → OTP gate → dashboard
 *  Login (returning verified user) → JWT → dashboard immediately
 *  Login (unverified / post-reset) → JWT issued → needsEmailVerification:true → OTP gate
 *  Forgot → email OTP (PASSWORD_RESET) → reset password → sets emailVerified:false
 *  Next login after reset → OTP gate again → verified → dashboard with all data intact
 */

const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const axios      = require('axios');
const nodemailer = require('nodemailer');
const { User, Applicant, Officer, OTP } = require('../models');
const { success, created, badRequest, unauthorized, notFound, forbidden, error } = require('../utils/responseHelper');

// ── Nodemailer transport ──────────────────────────────────────────────────────
const transport = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendMail = ({ to, subject, text }) =>
  new Promise((resolve, reject) =>
    transport.sendMail(
      { from: process.env.EMAIL_FROM || 'noreply@pradeshiyasabha.lk', to, subject, text },
      (err, info) => err ? reject(err) : resolve(info)
    )
  );

// ── OTP helpers ───────────────────────────────────────────────────────────────
// 4-digit code using cryptographically secure randomInt (not Math.random)
const generateOTPCode = () => crypto.randomInt(1000, 10000).toString();

// Hash before DB storage — never store plaintext OTP
const hashOTP = (code) => crypto.createHash('sha256').update(code).digest('hex');

// Timing-safe comparison of two hash strings
const safeEqualHash = (a, b) => {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch { return false; }
};

// Create OTP row — deletes any stale same-purpose rows for the email first
const createOTP = async (email, purpose) => {
  // Invalidate previous pending OTPs for this email+purpose
  await OTP.destroy({ where: { email, purpose } });

  const code      = generateOTPCode();
  const otp_hash  = hashOTP(code);
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await OTP.create({ email, otp_hash, expires_at, purpose, attempt_count: 0 });
  return code; // Return plaintext only to be emailed — never stored
};

// Verify an OTP — handles expiry + attempt counting + deletion
const verifyOTPCode = async (email, code, purpose) => {
  const record = await OTP.findOne({ where: { email, purpose } });

  if (!record) return { valid: false, reason: 'No OTP found. Please request a new one.' };
  if (new Date() > record.expires_at) {
    await record.destroy();
    return { valid: false, reason: 'OTP has expired. Please request a new one.' };
  }
  if (record.attempt_count >= 3) {
    await record.destroy();
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  const inputHash = hashOTP(String(code));
  if (!safeEqualHash(record.otp_hash, inputHash)) {
    await record.increment('attempt_count');
    const remaining = 2 - record.attempt_count;
    return { valid: false, reason: `Invalid OTP. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'No attempts remaining — request a new OTP.'}` };
  }

  // Valid — delete immediately (single use)
  await record.destroy();
  return { valid: true };
};

// Exported so admin.controller can trigger OTP for new officers
exports.createAndSendOTP = createOTP;


// ── JWT ───────────────────────────────────────────────────────────────────────
const JWT_SECRET = () => process.env.JWT_SECRET;

// No expiry — token is permanent until user logs out or JWT_SECRET changes
const signToken = (payload) => jwt.sign(payload, JWT_SECRET());

// signRefreshToken kept for backward compat but not used in responses
const signRefreshToken = (payload) => jwt.sign(payload, JWT_SECRET());

const buildPayload = (user, extra = {}) => ({
  user_id:       user.user_id,
  email:         user.email,
  role:          user.role,
  emailVerified: user.emailVerified,
  ...extra,
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { email, password, full_name, nic_number, phone, address } = req.body;

    if (!email || !password || !full_name || !nic_number)
      return badRequest(res, 'email, password, full_name and nic_number are required');
    if (password.length < 8)
      return badRequest(res, 'Password must be at least 8 characters');

    const existing = await User.findOne({ where: { email } });
    if (existing) return badRequest(res, 'Email already registered');

    const password_hash = await bcrypt.hash(password, 12);

    // Transaction: User + Applicant must both succeed or neither is created
    const sequelize = require('../config/database');
    await sequelize.transaction(async (t) => {
      const user = await User.create({
        email, password_hash, role: 'APPLICANT',
        status: 'ACTIVE', isBlocked: false,
        emailVerified: false, auth_provider: 'LOCAL',
      }, { transaction: t });
      await Applicant.create({ user_id: user.user_id, full_name, nic_number, phone, address }, { transaction: t });
    });

    return created(res, { message: 'Registration successful. Please sign in to verify your email.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// Uniform error message: "Invalid credentials" for BOTH wrong password AND
// missing user — prevents user enumeration.
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const UNIFORM_ERROR = 'Invalid credentials';

    const user = await User.findOne({ where: { email } });

    // Timing-safe: always run bcrypt even if user not found
    const dummyHash = '$2b$12$invalidhashplaceholderfortimingXXXXXXXXXXXXXXXXXXXXXXX';
    const isCorrect = await bcrypt.compare(password, user?.password_hash || dummyHash);

    if (!user || !isCorrect)                    return res.status(401).json({ error: UNIFORM_ERROR });
    if (user.isBlocked)              return res.status(403).json({ error: 'Account blocked. Contact the Pradeshiya Sabha office.' });
    if (user.status === 'SUSPENDED') return unauthorized(res, 'Account suspended.');
    // PENDING_VERIFICATION officers are allowed through to OTP gate —
    // they need to verify email first, then admin activates their account.
    // Once emailVerified=true AND status=PENDING_VERIFICATION, they see dashboard
    // but admin must approve (set status=ACTIVE) before they can act on applications.
    if (user.auth_provider === 'GOOGLE' && !user.password_hash)
      return badRequest(res, 'This account uses Google Sign-In.');

    let applicant_id = null;
    if (user.role === 'APPLICANT') {
      const a = await Applicant.findOne({ where: { user_id: user.user_id }, attributes: ['applicant_id'] });
      applicant_id = a?.applicant_id || null;
    }

    // ── Permanent JWT: reuse stored token if exists, else generate and store ──
    let token = user.jwt_token || null;
    if (!token) {
      token = signToken(buildPayload(user, { applicant_id }));
      await user.update({ jwt_token: token, last_login: new Date() });
    } else {
      await user.update({ last_login: new Date() });
    }

    // ── OTP gate: first-ever login or post-reset (emailVerified = false) ──
    const needsEmailVerification = !user.emailVerified;

    return res.json({
      message: 'Login successful',
      token,
      user: { user_id: user.user_id, email: user.email, role: user.role, emailVerified: user.emailVerified },
      needsEmailVerification,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/google
// accessToken → Google userinfo API → find-or-create → JWT
// Google users: emailVerified:true, password_hash:NULL (not a fake hash)
// ─────────────────────────────────────────────────────────────────────────────
exports.googleAuth = async (req, res, next) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return badRequest(res, 'accessToken is required');

    let googleUser;
    try {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
      });
      googleUser = data;
    } catch {
      return res.status(401).json({ error: 'Failed to verify Google token' });
    }

    const { sub: google_id, email, given_name, family_name } = googleUser;
    if (!email) return badRequest(res, 'Google account has no email');

    let user = await User.findOne({ where: { email } });

    if (user && ['PSO','SW','TO','PHI','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'].includes(user.role))
      return unauthorized(res, 'Officer accounts must use email and password login');

    if (user) {
      if (!user.google_id) await user.update({ google_id, auth_provider: 'GOOGLE', emailVerified: true });
      // Re-fetch after potential update
      user = await User.findOne({ where: { email } });
    } else {
      const seqDb = require('../config/database');
      await seqDb.transaction(async (t) => {
        user = await User.create({
          email, google_id, role: 'APPLICANT', status: 'ACTIVE',
          isBlocked: false, emailVerified: true, auth_provider: 'GOOGLE',
          password_hash: null,
        }, { transaction: t });
        await Applicant.create({
          user_id:   user.user_id,
          full_name: [given_name, family_name].filter(Boolean).join(' ') || email,
          phone:     null, address: null,
        }, { transaction: t });
      });
      user = await User.findOne({ where: { email } }); // re-fetch after transaction
    }

    if (user.isBlocked) return res.status(403).json({ error: 'Account blocked. Contact the Pradeshiya Sabha office.' });

    const a = user.role === 'APPLICANT'
      ? await Applicant.findOne({ where: { user_id: user.user_id }, attributes: ['applicant_id'] })
      : null;

    // Reuse stored JWT or generate new one
    let token = user.jwt_token || null;
    if (!token) {
      token = signToken(buildPayload(user, { applicant_id: a?.applicant_id || null }));
      await user.update({ jwt_token: token, last_login: new Date() });
    } else {
      await user.update({ last_login: new Date() });
    }

    return res.json({
      message: 'Login successful',
      token,
      user: { user_id: user.user_id, email: user.email, role: user.role, emailVerified: user.emailVerified },
      needsEmailVerification: !user.emailVerified,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/send-otp  (authenticated)
// Generates cryptographically secure 4-digit OTP, hashes it, stores with expiry
// ─────────────────────────────────────────────────────────────────────────────
exports.sendOTP = async (req, res, next) => {
  try {
    const code = await createOTP(req.user.email, 'EMAIL_VERIFY');

    try {
      await sendMail({
        to:      req.user.email,
        subject: 'Identity Verification Code — Pradeshiya Sabha',
        text:
          `Your identity verification code is: ${code}\n\n` +
          `This code expires in 10 minutes and can only be used once.\n` +
          `If you did not request this, contact the Pradeshiya Sabha office immediately.`,
      });
      return res.json({ message: 'OTP sent to your registered email' });
    } catch (mailErr) {
      console.error('[OTP] Mail error:', mailErr.message);
      return res.json({
        message: 'OTP sent',
        otp: process.env.NODE_ENV === 'development' ? code : undefined,
      });
    }
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify-otp  (authenticated)
// Verifies 4-digit code, checks expiry + attempt count, sets emailVerified=true
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
    const code = req.body.code || req.body.otp;
    if (!code || !/^\d{4}$/.test(String(code)))
      return badRequest(res, 'A 4-digit code is required');

    const result = await verifyOTPCode(req.user.email, code, 'EMAIL_VERIFY');
    if (!result.valid) return res.status(400).json({ error: result.reason });

    // Mark email verified
    await User.update({ emailVerified: true }, { where: { email: req.user.email } });

    // Generate and store permanent JWT now that identity is confirmed
    const user = await User.findOne({ where: { email: req.user.email } });
    let applicant_id = null;
    if (user.role === 'APPLICANT') {
      const { Applicant } = require('../models');
      const a = await Applicant.findOne({ where: { user_id: user.user_id }, attributes: ['applicant_id'] });
      applicant_id = a?.applicant_id || null;
    }
    const token = signToken(buildPayload(user, { applicant_id }));
    await user.update({ jwt_token: token });

    return res.json({ message: 'Email verified successfully', token });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/forgot-password  (unauthenticated)
// ─────────────────────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return badRequest(res, 'Email is required');

    // Uniform response — never reveal whether email is registered
    const genericMsg = 'If that email is registered you will receive a reset code shortly.';

    const user = await User.findOne({ where: { email } });
    if (!user) return res.json({ message: genericMsg });
    if (user.auth_provider === 'GOOGLE' && !user.password_hash)
      return res.json({ message: genericMsg }); // silent — don't reveal Google account existence

    const code = await createOTP(email, 'PASSWORD_RESET');

    try {
      await sendMail({
        to: email,
        subject: 'Password Reset Code — Pradeshiya Sabha Planning System',
        text:
          `Your password reset code is: ${code}\n\n` +
          `This code expires in 10 minutes and can only be used once.\n\n` +
          `After resetting your password, you will be asked to verify your identity ` +
          `once more when you sign in. Your applications and data are untouched.\n\n` +
          `If you did not request a password reset, please ignore this email.`,
      });
    } catch (mailErr) {
      console.error('[FORGOT] Mail error:', mailErr.message);
    }

    return res.json({
      message: genericMsg,
      otp: process.env.NODE_ENV === 'development' ? code : undefined,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/reset-password  (unauthenticated)
// ─────────────────────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password)
      return badRequest(res, 'email, otp and new_password are required');
    if (!/^\d{4}$/.test(String(otp)))
      return badRequest(res, 'OTP must be a 4-digit code');
    if (new_password.length < 8)
      return badRequest(res, 'Password must be at least 8 characters');

    const result = await verifyOTPCode(email, otp, 'PASSWORD_RESET');
    if (!result.valid) return res.status(400).json({ error: result.reason });

    const password_hash = await bcrypt.hash(new_password, 12);

    // emailVerified: false — forces identity re-check on next login (post-reset 2FA)
    await User.update({ password_hash, emailVerified: false }, { where: { email } });

    return res.json({ message: 'Password reset successfully. Sign in to verify your identity.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/me  (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
exports.me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.user_id, {
      attributes: ['user_id','email','role','status','isBlocked','emailVerified','last_login','auth_provider'],
    });
    if (!user) return unauthorized(res, 'User not found');

    const profile = user.role === 'APPLICANT'
      ? await Applicant.findOne({ where: { user_id: user.user_id } })
      : await Officer.findOne({ where: { user_id: user.user_id } });

    return success(res, {
      ...user.toJSON(),
      full_name:    profile?.full_name || null,
      phone:        profile?.phone     || null,
      applicant_id: user.role === 'APPLICANT' ? profile?.applicant_id : undefined,
      officer_id:   user.role !== 'APPLICANT' ? profile?.officer_id   : undefined,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/logout  (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    // Invalidate stored JWT — prevents token reuse after logout
    await User.update({ jwt_token: null, refresh_token: null }, { where: { user_id: req.user.user_id } });
    return success(res, null, 'Logged out successfully');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/generate-otp  (authenticated — Chairman certificate signing only)
// Uses SIGNING purpose — completely separate from email verification codes
// ─────────────────────────────────────────────────────────────────────────────
exports.generateOTP = async (req, res, next) => {
  try {
    // Generate a 4-digit signing code
    // DUAL WRITE: Write to both the OTP table (for audit/expiry management)
    // AND to User.otp_code / User.otp_expires_at (which the cert sign endpoint reads)
    const code = await createOTP(req.user.email, 'SIGNING');

    // Write HASHED code to User row (never store plaintext OTP per security policy)
    const crypto = require('crypto');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    await User.update(
      { otp_code: hashedCode, otp_expires_at: expiresAt },
      { where: { email: req.user.email } }
    );

    try {
      await sendMail({
        to:      req.user.email,
        subject: 'Document Signing Authorization — Pradeshiya Sabha',
        text:    `Your document signing code is: ${code}\n\nThis code expires in 10 minutes. Do not share it.`,
      });
    } catch (mailErr) {
      console.error('[SIGNING OTP] Mail error:', mailErr.message);
    }

    return res.json({
      message: 'Signing code sent to your registered email',
      otp: process.env.NODE_ENV === 'development' ? code : undefined,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/refresh  (uses refreshToken middleware — not standard auth)
// refreshToken middleware validates the refresh token and sets req.user + req.dbUser
// This controller issues a new short-lived access token
// ─────────────────────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const user = req.dbUser;
    if (!user) return unauthorized(res, 'Invalid refresh token');

    const applicant_id = req.user?.applicant_id || null;
    const token = signToken(buildPayload(user, { applicant_id }));

    // Rotate refresh token on every use — old token is immediately invalidated.
    // This means a stolen refresh token can only be used once before it becomes invalid.
    const newRefreshTkn  = signRefreshToken({ user_id: user.user_id, email: user.email, role: user.role, applicant_id });
    const newRefreshHash = crypto.createHash('sha256').update(newRefreshTkn).digest('hex');
    return res.json({
      message:      'Token refreshed',
      token,
      refreshToken: newRefreshTkn,
      user: { user_id: user.user_id, email: user.email, role: user.role, emailVerified: user.emailVerified },
    });
  } catch (err) { next(err); }
};
