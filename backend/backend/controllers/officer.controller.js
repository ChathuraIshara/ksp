const { Officer, User, TaskAssignment } = require('../models');
const { success, created, notFound, error } = require('../utils/responseHelper');
const { Op } = require('sequelize');

exports.createOfficer = async (req, res, next) => {
  try {
    // Whitelist — user_id must come from a trusted source (linked User record),
    // never from the request body. is_active, verified_by, verified_at are
    // set only by admin verify/reject endpoints.
    const { user_id, full_name, nic_number, designation, department, phone, employee_id } = req.body;
    if (!user_id || !full_name) {
      const { badRequest } = require('../utils/responseHelper');
      return badRequest(res, 'user_id and full_name are required');
    }
    const officer = await Officer.create({ user_id, full_name, nic_number, designation, department, phone, employee_id });
    return created(res, officer);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const o = await Officer.findByPk(req.params.id, { include: [{ model: User, attributes: ['email','role','status'] }] });
    if (!o) return notFound(res);
    return success(res, o);
  } catch (err) { next(err); }
};

exports.getByUserId = async (req, res, next) => {
  try {
    const o = await Officer.findOne({ where: { user_id: req.params.userId } });
    if (!o) return notFound(res);
    return success(res, o);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const o = await Officer.findByPk(req.params.id);
    if (!o) return notFound(res);
    // Whitelist — user_id, is_active, verified_by/at, digital_signature_path
    // must never be overwritten through a generic profile update.
    const ALLOWED = ['full_name', 'nic_number', 'designation', 'department', 'phone', 'employee_id'];
    const safe = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) safe[key] = req.body[key];
    }
    await o.update(safe);
    return success(res, o);
  } catch (err) { next(err); }
};

exports.verifyOfficer = async (req, res, next) => {
  try {
    const o = await Officer.findByPk(req.params.id);
    if (!o) return notFound(res);
    await o.update({ verified_by: req.user.user_id, verified_at: new Date(), is_active: true });
    await User.update({ status: 'ACTIVE', is_verified: true }, { where: { user_id: o.user_id } });
    return success(res, null, 'Officer verified');
  } catch (err) { next(err); }
};

exports.rejectOfficer = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const o = await Officer.findByPk(req.params.id);
    if (!o) return notFound(res);
    await o.update({ rejection_reason: reason, is_active: false });
    await User.update({ status: 'REJECTED' }, { where: { user_id: o.user_id } });
    return success(res, null, 'Officer rejected');
  } catch (err) { next(err); }
};

exports.listPendingVerifications = async (req, res, next) => {
  try {
    const officers = await Officer.findAll({
      include: [{ model: User, attributes: ['email','role','status'], where: { status: 'PENDING_VERIFICATION' } }],
    });
    return success(res, officers);
  } catch (err) { next(err); }
};

exports.getWorkloadScore = async (req, res, next) => {
  try {
    const count = await TaskAssignment.count({ where: { assigned_to: req.params.id, status: { [Op.in]: ['PENDING','IN_PROGRESS'] } } });
    return success(res, { officer_id: req.params.id, active_tasks: count });
  } catch (err) { next(err); }
};

exports.getActiveTaskCount = async (req, res, next) => {
  try {
    const count = await TaskAssignment.count({ where: { assigned_to: req.params.id, status: { [Op.in]: ['PENDING','IN_PROGRESS'] } } });
    return success(res, { count });
  } catch (err) { next(err); }
};

/**
 * GET /officers?role=TO&user_id=xxx — list officers with optional filters
 * Used by SW dashboard to list TOs, by frontend to find officer by user_id
 */
exports.listAll = async (req, res, next) => {
  try {
    const { role, user_id, is_active } = req.query;
    const userWhere = {};
    if (role) userWhere.role = role;

    const officerWhere = {};
    if (user_id) officerWhere.user_id = user_id;
    if (is_active !== undefined) officerWhere.is_active = is_active === 'true';

    const officers = await Officer.findAll({
      where: officerWhere,
      include: [{ model: User, attributes: ['email','role','status'], where: userWhere, required: Object.keys(userWhere).length > 0 }],
      order: [['full_name','ASC']],
    });
    return success(res, officers);
  } catch (err) { next(err); }
};
