const { User } = require('../models');
const authService = require('../services/auth.service');
const { success, notFound, badRequest, error } = require('../utils/responseHelper');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id || req.user.user_id, { attributes: { exclude: ['password_hash','refresh_token','otp_code'] } });
    if (!user) return notFound(res);
    return success(res, user);
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return notFound(res);

    // Only the account owner or ADMIN can update a profile
    const isAdmin = req.user.role === 'ADMIN';
    const isSelf  = req.user.user_id === user.user_id;
    if (!isAdmin && !isSelf) {
      const { forbidden } = require('../utils/responseHelper');
      return forbidden(res, 'You can only update your own profile');
    }

    // Whitelist — never allow role, status, password_hash, refresh_token, otp_* to be
    // set through this generic endpoint; those have dedicated routes.
    const ALLOWED = ['email'];
    const safe = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) safe[key] = req.body[key];
    }

    if (Object.keys(safe).length === 0) {
      return badRequest(res, 'No updatable fields provided. Only email can be changed here.');
    }

    await user.update(safe);
    const updated = await User.findByPk(user.user_id, {
      attributes: { exclude: ['password_hash','refresh_token','otp_code','otp_expires_at'] },
    });
    return success(res, updated);
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.user_id);
    const valid = await authService.comparePassword(currentPassword, user.password_hash);
    if (!valid) return badRequest(res, 'Current password incorrect');
    const hash = await authService.hashPassword(newPassword);
    await user.update({ password_hash: hash });
    return success(res, null, 'Password changed');
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING_VERIFICATION'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return badRequest(res, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return notFound(res);
    await user.update({ status });
    return success(res, user, 'Status updated');
  } catch (err) { next(err); }
};

exports.listByRole = async (req, res, next) => {
  try {
    const { role } = req.query;
    const where = role ? { role } : {};
    const users = await User.findAll({ where, attributes: { exclude: ['password_hash','refresh_token','otp_code'] } });
    return success(res, users);
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    // Soft delete only — hard delete would break audit trail, FK references,
    // and historical application/minute records. Status INACTIVE preserves integrity.
    const user = await User.findByPk(req.params.id);
    if (!user) return notFound(res);
    if (user.user_id === req.user.user_id) return badRequest(res, 'Cannot deactivate your own account');
    await user.update({ status: 'SUSPENDED', refresh_token: null });
    return success(res, null, 'User account deactivated (soft delete — records preserved for audit trail)');
  } catch (err) { next(err); }
};
