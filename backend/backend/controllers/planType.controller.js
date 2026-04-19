const { PlanType } = require('../models');
const feeService = require('../services/feeCalculator.service');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.createPlanType = async (req, res, next) => {
  try { return created(res, await PlanType.create(req.body)); } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const p = await PlanType.findByPk(req.params.id);
    if (!p) return notFound(res);
    return success(res, p);
  } catch (err) { next(err); }
};

exports.getByName = async (req, res, next) => {
  try {
    const p = await PlanType.findOne({ where: { display_name: req.params.name } });
    if (!p) return notFound(res);
    return success(res, p);
  } catch (err) { next(err); }
};

exports.getAllActive = async (req, res, next) => {
  try { return success(res, await PlanType.findAll({ where: { is_active: true } })); } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const p = await PlanType.findByPk(req.params.id);
    if (!p) return notFound(res);
    await p.update(req.body);
    return success(res, p);
  } catch (err) { next(err); }
};

exports.updateRequiredDocuments = async (req, res, next) => {
  try {
    await PlanType.update({ required_documents: req.body.required_documents }, { where: { plan_type_id: req.params.id } });
    return success(res, null, 'Required documents updated');
  } catch (err) { next(err); }
};

exports.deactivate = async (req, res, next) => {
  try {
    await PlanType.update({ is_active: false }, { where: { plan_type_id: req.params.id } });
    return success(res, null, 'Deactivated');
  } catch (err) { next(err); }
};

exports.calculateApplicationFee = async (req, res, next) => {
  try {
    const fee = await feeService.calculateApplicationFee(req.params.id);
    return success(res, { plan_type_id: req.params.id, fee });
  } catch (err) { next(err); }
};

exports.getRequiredDocuments = async (req, res, next) => {
  try {
    const p = await PlanType.findByPk(req.params.id, { attributes: ['required_documents'] });
    if (!p) return notFound(res);
    return success(res, p.required_documents || []);
  } catch (err) { next(err); }
};
