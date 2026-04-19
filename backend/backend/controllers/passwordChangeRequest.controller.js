/**
 * passwordChangeRequest.controller.js
 *
 * Officer/Applicant requests a password change.
 * Admin approves or rejects.
 * On approval: password updated, JWT invalidated (set to NULL).
 * Next login generates fresh JWT.
 */
const bcrypt = require('bcryptjs');
const { User, PasswordChangeRequest } = require('../models');
const notifService = require('../services/notification.service');
const { success, created, notFound, badRequest, forbidden } = require('../utils/responseHelper');

// ── POST /password-change-requests ────────────────────────────────────────────
// Officer or applicant submits a password change request
exports.createRequest = async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8)
      return badRequest(res, 'New password must be at least 8 characters');

    // Check no pending request already exists
    const existing = await PasswordChangeRequest.findOne({
      where: { user_id: req.user.user_id, status: 'PENDING' },
    });
    if (existing)
      return badRequest(res, 'A password change request is already pending admin approval');

    const new_password_hash = await bcrypt.hash(new_password, 12);
    const req_record = await PasswordChangeRequest.create({
      user_id:          req.user.user_id,
      new_password_hash,
      status:           'PENDING',
    });

    // Notify admin
    const admin = await User.findOne({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (admin) {
      await notifService.dispatch({
        recipient_id:    admin.user_id,
        event_type:      'PASSWORD_CHANGE_REQUEST',
        title:           'Password Change Request',
        body:            `User ${req.user.email} has requested a password change. Please review in Admin Dashboard.`,
        reference_number: req_record.request_id,
        channel:         'IN_APP',
      });
    }

    return created(res, { request_id: req_record.request_id }, 'Password change request submitted. Awaiting admin approval.');
  } catch (err) { next(err); }
};

// ── GET /password-change-requests ─────────────────────────────────────────────
// Admin views all pending requests
exports.listPending = async (req, res, next) => {
  try {
    const requests = await PasswordChangeRequest.findAll({
      where: { status: 'PENDING' },
      include: [{ model: User, attributes: ['user_id','email','role','full_name'] }],
      order: [['created_at', 'ASC']],
    });
    return success(res, requests);
  } catch (err) { next(err); }
};

// ── PUT /password-change-requests/:id/approve ─────────────────────────────────
// Admin approves → update password + invalidate JWT
exports.approve = async (req, res, next) => {
  try {
    const pcr = await PasswordChangeRequest.findByPk(req.params.id);
    if (!pcr)            return notFound(res);
    if (pcr.status !== 'PENDING') return badRequest(res, 'Request already resolved');

    // Update user password and invalidate JWT
    await User.update(
      { password_hash: pcr.new_password_hash, jwt_token: null },
      { where: { user_id: pcr.user_id } }
    );

    await pcr.update({ status: 'APPROVED', resolved_at: new Date(), resolved_by: req.user.user_id });

    // Notify officer/applicant
    await notifService.dispatch({
      recipient_id:  pcr.user_id,
      event_type:    'PASSWORD_CHANGE_APPROVED',
      title:         'Password Change Approved',
      body:          'Your password change request has been approved. Please log in with your new password.',
      channel:       'IN_APP',
    });

    return success(res, null, 'Password changed. User JWT invalidated — next login generates fresh token.');
  } catch (err) { next(err); }
};

// ── PUT /password-change-requests/:id/reject ──────────────────────────────────
// Admin rejects
exports.reject = async (req, res, next) => {
  try {
    const pcr = await PasswordChangeRequest.findByPk(req.params.id);
    if (!pcr)            return notFound(res);
    if (pcr.status !== 'PENDING') return badRequest(res, 'Request already resolved');

    const { reason } = req.body;
    await pcr.update({ status: 'REJECTED', resolved_at: new Date(), resolved_by: req.user.user_id, reject_reason: reason || null });

    // Notify officer/applicant
    await notifService.dispatch({
      recipient_id:  pcr.user_id,
      event_type:    'PASSWORD_CHANGE_REJECTED',
      title:         'Password Change Rejected',
      body:          reason ? `Your password change request was rejected: ${reason}` : 'Your password change request was rejected by admin.',
      channel:       'IN_APP',
    });

    return success(res, null, 'Password change request rejected.');
  } catch (err) { next(err); }
};

// ── GET /password-change-requests/my ──────────────────────────────────────────
// Officer/applicant checks status of their own request
exports.myRequest = async (req, res, next) => {
  try {
    const latest = await PasswordChangeRequest.findOne({
      where: { user_id: req.user.user_id },
      order: [['created_at', 'DESC']],
    });
    return success(res, latest);
  } catch (err) { next(err); }
};
