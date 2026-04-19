const { FeeConfiguration } = require('../models');
const feeService  = require('../services/feeCalculator.service');
const fineService = require('../services/fineCalculator.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

exports.createConfig = async (req, res, next) => {
  try { return created(res, await FeeConfiguration.create(req.body)); } catch (err) { next(err); }
};

exports.getAllActive = async (req, res, next) => {
  try { return success(res, await FeeConfiguration.findAll({ where: { is_active: true } })); } catch (err) { next(err); }
};

exports.getByPlanType = async (req, res, next) => {
  try { return success(res, await FeeConfiguration.findAll({ where: { plan_type_id: req.params.planTypeId, is_active: true } })); } catch (err) { next(err); }
};

// ← NEW: get a single fee config by primary key
exports.getById = async (req, res, next) => {
  try {
    const cfg = await FeeConfiguration.findByPk(req.params.id);
    if (!cfg) return notFound(res);
    return success(res, cfg);
  } catch (err) { next(err); }
};

exports.updateRates = async (req, res, next) => {
  try {
    const c = await FeeConfiguration.findByPk(req.params.id);
    if (!c) return notFound(res);
    await c.update(req.body);
    return success(res, c);
  } catch (err) { next(err); }
};

exports.deactivate = async (req, res, next) => {
  try {
    await FeeConfiguration.update({ is_active: false }, { where: { fee_config_id: req.params.id } });
    return success(res, null, 'Deactivated');
  } catch (err) { next(err); }
};

exports.calculateBuildingFee = async (req, res, next) => {
  try {
    // Accept sqm (new) or sqft (legacy) — convert sqft to sqm if needed
    // story_type: 'single' | 'multi' — from applicant form selection
    const { plan_type_id, sqm, sqft, story_type, is_unauthorized } = req.body;
    let areaSqm = 0;
    if (sqm !== undefined && sqm !== null && sqm !== '') {
      areaSqm = Number.parseFloat(sqm);
    } else if (sqft !== undefined && sqft !== null && sqft !== '') {
      areaSqm = Number.parseFloat(sqft) * 0.092903;
    }
    if (!areaSqm || Number.isNaN(areaSqm)) return badRequest(res, 'sqm or sqft is required');

    // Normalize story type from frontend values
    const storyTypeRaw = String(story_type || '').toUpperCase();
    let normalizedStoryType = null;
    if (storyTypeRaw === 'MULTI' || storyTypeRaw === 'MULTI_STORY') {
      normalizedStoryType = 'MULTI_STORY';
    } else if (storyTypeRaw === 'SINGLE' || storyTypeRaw === 'SINGLE_STORY') {
      normalizedStoryType = 'SINGLE_STORY';
    }

    // Use gazette-based service calculation (tiered by sqm)
    let fee;
    if (is_unauthorized) {
      // Unauthorized construction: use highest applicable rate as penalty
      const calc = require('../utils/feeCalculator');
      const baseFee = calc.calculateBuildingFee(areaSqm, false, false);
      fee = Math.round(baseFee * 1.5); // 50% surcharge for unauthorized
    } else {
      fee = await feeService.calculateBuildingFee(plan_type_id, areaSqm, normalizedStoryType);
    }

    return success(res, { fee, area_sqm: areaSqm, story_type: normalizedStoryType || 'SINGLE_STORY' });
  } catch (err) { next(err); }
};

exports.calculatePlotFee = async (req, res, next) => {
  try {
    const { plan_type_id, perches, is_subdivided } = req.body;
    if (!perches) return badRequest(res, 'perches is required');
    const fee = plan_type_id
      ? await feeService.calculatePlotFee(plan_type_id, parseFloat(perches), !!is_subdivided)
      : require('../utils/feeCalculator').calculateSubdivisionFeePerPlot(parseFloat(perches));
    return success(res, { fee, perches: parseFloat(perches), is_subdivided: !!is_subdivided });
  } catch (err) { next(err); }
};

exports.calculateWallFee = async (req, res, next) => {
  try {
    const { plan_type_id, length_metres } = req.body;
    if (!length_metres) return badRequest(res, 'length_metres is required');
    // Wall fee: Rs.100/lm per gazette. plan_type_id used only if FeeConfiguration override exists.
    const fee = plan_type_id
      ? await feeService.calculateBuildingFee(plan_type_id, parseFloat(length_metres))
      : require('../utils/feeCalculator').calculateWallFee(parseFloat(length_metres));
    return success(res, { fee, length_metres: parseFloat(length_metres) });
  } catch (err) { next(err); }
};

exports.calculateUnauthorizedFine = async (req, res, next) => {
  try {
    const { sqft, plan_type_id } = req.body;
    const fine = await fineService.calculateUnauthorizedFine(parseFloat(sqft), plan_type_id);
    return success(res, { fine });
  } catch (err) { next(err); }
};

exports.calculateExtensionFee = async (req, res, next) => {
  try { return success(res, { fee: 'Extension fee calculation' }); } catch (err) { next(err); }
};

exports.calculateLateCORFine = async (req, res, next) => {
  try {
    const { days_overdue } = req.body;
    const fine = await fineService.calculateLateCORFine(parseInt(days_overdue));
    return success(res, { fine });
  } catch (err) { next(err); }
};

exports.getUnauthorizedRate = async (req, res, next) => {
  try {
    const { plan_type } = req.query;
    const { FeeConfiguration, PlanType } = require('../models');
    const { Op } = require('sequelize');
    // Find matching plan type
    const pt = await PlanType.findOne({
      where: plan_type
        ? { subtype: { [Op.like]: `%${plan_type}%` } }
        : {},
    });
    const cfg = pt ? await FeeConfiguration.findOne({
      where: { plan_type_id: pt.plan_type_id, fee_type: 'FINE', is_active: true }
    }) : null;
    const rate_per_sqft = cfg?.rate_per_sqft || 150; // gazette default
    const min_fine = cfg?.min_fee || 5000;
    return success(res, { rate_per_sqft, min_fine, plan_type });
  } catch (err) { next(err); }
};

