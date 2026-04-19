const { AuditLog, Application } = require('../models');
const { Op } = require('sequelize');
const { success, notFound, error } = require('../utils/responseHelper');

exports.getByUser = async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({
      where: { user_id: req.params.userId },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return success(res, logs);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const app = await Application.findOne({ where: { reference_number: req.params.ref } });
    if (!app) return notFound(res, 'Application not found');
    const logs = await AuditLog.findAll({
      where: { entity_id: app.application_id, entity_type: 'Application' },
      order: [['created_at', 'ASC']],
    });
    return success(res, logs);
  } catch (err) { next(err); }
};

exports.getByAction = async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({
      where: { action: req.params.action },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return success(res, logs);
  } catch (err) { next(err); }
};

exports.getByDateRange = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return error(res, 'from and to query params required', 400);
    const logs = await AuditLog.findAll({
      where: { created_at: { [Op.between]: [new Date(from), new Date(to)] } },
      order: [['created_at', 'DESC']],
    });
    return success(res, logs);
  } catch (err) { next(err); }
};

exports.searchLogs = async (req, res, next) => {
  try {
    const { entity_type, action, user_id, from, to } = req.query;
    const where = {};
    if (entity_type) where.entity_type = entity_type;
    if (action) where.action = action;
    if (user_id) where.user_id = user_id;
    if (from && to) where.created_at = { [Op.between]: [new Date(from), new Date(to)] };
    const logs = await AuditLog.findAll({ where, order: [['created_at', 'DESC']], limit: 500 });
    return success(res, logs);
  } catch (err) { next(err); }
};

exports.exportLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({ order: [['created_at', 'ASC']] });
    const csv = [
      'audit_id,user_id,action,entity_type,entity_id,created_at',
      ...logs.map(l => `${l.audit_id},${l.user_id},${l.action},${l.entity_type},${l.entity_id},${l.created_at}`),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
    return res.send(csv);
  } catch (err) { next(err); }
};

exports.logAction = async (req, res, next) => {
  try {
    const log = await AuditLog.create({ ...req.body, user_id: req.user.user_id, is_immutable: true });
    return success(res, log, 'Action logged');
  } catch (err) { next(err); }
};
