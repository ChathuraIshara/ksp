const { Minute } = require('../models');
const lockdownService = require('../services/lockdown.service');
const swWorkflowService = require('../services/swWorkflow.service');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.createMinute = async (req, res, next) => {
  try {
    // Compatibility shim: components send 'observations' but model column is 'content'
    const body = { ...req.body };
    if (!body.content && body.observations) body.content = body.observations;
    if (!body.content && body.recommendation) body.content = body.recommendation;
    if (!body.content) body.content = 'No content provided';
    return created(res, await Minute.create({ ...body, authored_by: req.user.user_id }));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const m = await Minute.findByPk(req.params.id);
    if (!m) return notFound(res);
    return success(res, m);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try { return success(res, await Minute.findAll({ where: { reference_number: req.params.ref } })); } catch (err) { next(err); }
};

exports.getByOfficer = async (req, res, next) => {
  try { return success(res, await Minute.findAll({ where: { authored_by: req.params.officerId } })); } catch (err) { next(err); }
};

exports.getByType = async (req, res, next) => {
  try { return success(res, await Minute.findAll({ where: { reference_number: req.params.ref, minute_type: req.params.type } })); } catch (err) { next(err); }
};

exports.saveDraft = async (req, res, next) => {
  try {
    const m = await Minute.findByPk(req.params.id);
    if (!m) return notFound(res);
    await m.update({ ...req.body, status: 'DRAFT' });
    return success(res, m);
  } catch (err) { next(err); }
};

exports.submitMinute = async (req, res, next) => {
  try {
    const m = await Minute.findByPk(req.params.id);
    if (!m) return notFound(res);
    await m.update({ status: 'SUBMITTED', submitted_at: new Date() });

    // If SW review minute — trigger external approval creation
    if (['SW_INITIAL_REVIEW','SW_FINAL_REVIEW'].includes(m.minute_type)) {
      await swWorkflowService.onSWReviewSubmit(m.minute_id, m.application_id, m.reference_number, req.user.user_id);
    }
    await lockdownService.lockRecord(Minute, req.params.id);
    return success(res, null, 'Minute submitted');
  } catch (err) { next(err); }
};

exports.attachDocuments = async (req, res, next) => {
  try {
    const m = await Minute.findByPk(req.params.id);
    if (!m) return notFound(res);
    const attachments = [...(m.attachments || []), ...(req.body.document_ids || [])];
    await m.update({ attachments });
    return success(res, { attachments });
  } catch (err) { next(err); }
};

exports.forwardMinute = async (req, res, next) => {
  try {
    await Minute.update({ forwarded_to: req.body.officer_id, forwarded_at: new Date() }, { where: { minute_id: req.params.id } });
    return success(res, null, 'Minute forwarded');
  } catch (err) { next(err); }
};

exports.updateVisibility = async (req, res, next) => {
  try {
    await Minute.update({ visibility: req.body.visibility }, { where: { minute_id: req.params.id } });
    return success(res, null, 'Visibility updated');
  } catch (err) { next(err); }
};

exports.lockMinute = async (req, res, next) => {
  try {
    await lockdownService.lockRecord(Minute, req.params.id);
    return success(res, null, 'Minute locked');
  } catch (err) { next(err); }
};

exports.getMinuteForNode = async (req, res, next) => {
  try {
    // Validate officerType to prevent wildcard injection
    const safeType = (req.params.officerType || '').replace(/[%_]/g,'').toUpperCase().slice(0,50);
    if (!safeType) return notFound(res);
    const { Op } = require('sequelize');
    const m = await Minute.findOne({ where: { reference_number: req.params.ref, minute_type: { [Op.like]: `%${safeType}%` } } });
    if (!m) return notFound(res);
    return success(res, m);
  } catch (err) { next(err); }
};
