/**
 * Fee Calculator Service
 * Wraps gazette-based fee calculator utils with plan-type awareness.
 * All building fees use sq.metres (sqm) per the KPS gazette PDF.
 * Boundary wall fees: Rs.100/linear metre.
 * Subdivision fees: per-plot flat fee based on plot size band.
 *
 * story_type resolution order (Issue 2 fix):
 *  1. Explicit story_type param passed by caller (most reliable — from Application.story_type)
 *  2. PlanType subtype string inference (fallback for legacy callers)
 * This ensures mixed-use (Shop House) and other building types always use the
 * applicant's declared story type for the correct gazette fee tier.
 */
const { FeeConfiguration, PlanType } = require('../models');
const { Op } = require('sequelize');
const calc = require('../utils/feeCalculator');

const isCommercialPlanType = (planType) => {
  if (!planType) return false;
  const sub = (planType.subtype || '').toUpperCase();
  return ['COMMERCIAL','INDUSTRIAL','STOREROOM','WAREHOUSE'].some(k => sub.includes(k));
};

const isMultiStoryPlanType = (planType) => {
  if (!planType) return false;
  const sub = (planType.subtype || '').toUpperCase();
  return sub.includes('MULTI') || sub.includes('APARTMENT');
};

/**
 * Calculate building approval fee.
 * @param {number|string} planTypeId
 * @param {number} sqm  Floor area in square metres
 * @param {string|null} storyType  'SINGLE_STORY' | 'MULTI_STORY' | null
 *   When provided (from Application.story_type), this takes precedence over
 *   plan type subtype inference — fixing the mixed-use building fee issue.
 */
const calculateBuildingFee = async (planTypeId, sqm, storyType = null) => {
  console.log("calculateBuildingFee called with:", { planTypeId, sqm, storyType });
  const planType = await PlanType.findByPk(planTypeId);
  if (!planType) throw new Error('Plan type not found');

  // Check for custom FeeConfiguration override
  const cfg = await FeeConfiguration.findOne({
    where: {
      plan_type_id: planTypeId,
      fee_type: 'APPROVAL',
      is_active: true,
      effective_from: { [Op.lte]: new Date() },
      [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: new Date() } }],
    },
  });

  // Boundary wall: always Rs.100/lm (gazette rate), cfg can override
  if (planType.category === 'BOUNDARY_WALL') {
    if (cfg?.rate_per_lm) return Math.round(sqm * Number(cfg.rate_per_lm));
    return calc.calculateWallFee(sqm); // sqm used as linear metres for walls
  }

  // Building plans: always follow gazette table bands (per provided fee schedule).
  // Do not override with FeeConfiguration for building approval calculation.

  // Issue 2 fix: resolve story type from explicit param first, then plan type subtype
  const isNonResidential = isCommercialPlanType(planType);
  let isMultiStory;
  if (storyType === 'MULTI_STORY') {
    isMultiStory = true;
  } else if (storyType === 'SINGLE_STORY') {
    isMultiStory = false;
  } else {
    // Fallback: infer from plan type subtype string (legacy behaviour)
    isMultiStory = isMultiStoryPlanType(planType);
  }

  return calc.calculateBuildingFee(sqm, isMultiStory, isNonResidential);
};

const calculateApplicationFee = async (planTypeId) => {
  const cfg = await FeeConfiguration.findOne({
    where: {
      plan_type_id: planTypeId,
      fee_type: 'APPLICATION',
      is_active: true,
      effective_from: { [Op.lte]: new Date() },
      [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: new Date() } }],
    },
  });
  return cfg ? Number(cfg.flat_fee || calc.APPLICATION_FORM_FEE) : calc.APPLICATION_FORM_FEE;
};

const calculateExtensionFee = async ({ planTypeId } = {}) => {
  const planType = planTypeId ? await PlanType.findByPk(planTypeId) : null;
  const isCommercial = isCommercialPlanType(planType);
  return calc.calculateExtensionFee(isCommercial);
};

const calculateCOCFee = async (sqft, planTypeId) => {
  const planType = planTypeId ? await PlanType.findByPk(planTypeId) : null;
  const isCommercial = isCommercialPlanType(planType);
  return calc.calculateCOCFee(sqft, isCommercial);
};

const getActiveConfig = async (planTypeId, feeType) => {
  return FeeConfiguration.findOne({
    where: {
      plan_type_id: planTypeId,
      fee_type: feeType,
      is_active: true,
      effective_from: { [Op.lte]: new Date() },
      [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: new Date() } }],
    },
  });
};

/**
 * Calculate Plot of Land fee.
 * Whole land approval: uses FeeConfiguration rate_per_perch.
 * Subdivided plots: per-plot flat fee based on plot size band (gazette spec).
 *
 * @param {string} planTypeId
 * @param {number} perches  Plot size in perches
 * @param {boolean} isSubdivided  true = subdivided plot (per-plot fee applies)
 */
const calculatePlotFee = async (planTypeId, perches, isSubdivided = false) => {
  if (isSubdivided) {
    // Per-plot fee based on plot size — gazette table
    return calc.calculateSubdivisionFeePerPlot(perches);
  }

  // Whole land approval — configurable rate
  const cfg = await FeeConfiguration.findOne({
    where: {
      plan_type_id: planTypeId,
      fee_type: 'APPROVAL',
      is_active: true,
      effective_from: { [Op.lte]: new Date() },
      [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: new Date() } }],
    },
  });

  const ratePerPerch = cfg?.rate_per_lm || cfg?.rate_per_sqft || 100;
  const flatFee      = cfg?.flat_fee || 0;
  const minFee       = cfg?.min_fee  || 500;

  return calc.calculatePlotFee(perches, Number(ratePerPerch), Number(flatFee), Number(minFee));
};

/**
 * Single entry-point: route to correct fee function by plan type category.
 * @param {string} planTypeId
 * @param {number} measurement  sqm for buildings, perches for plots, linear metres for walls
 * @param {string|null} storyType  'SINGLE_STORY' | 'MULTI_STORY' — from Application.story_type
 */
const calculateApprovalFee = async (planTypeId, measurement, storyType = null) => {
  const planType = await PlanType.findByPk(planTypeId);
  if (!planType) throw new Error('Plan type not found');

  switch (planType.category) {
    case 'BUILDING_PLAN':
      return calculateBuildingFee(planTypeId, measurement, storyType);   // pass story_type
    case 'PLOT_OF_LAND': {
      const isSubdivided = (planType.subtype || '').toUpperCase().includes('SUBDIVIDED');
      return calculatePlotFee(planTypeId, measurement, isSubdivided);
    }
    case 'BOUNDARY_WALL':
      return calculateBuildingFee(planTypeId, measurement, null);         // walls have no story type
    default:
      return calculateBuildingFee(planTypeId, measurement, storyType);
  }
};

module.exports = {
  calculateBuildingFee,
  calculatePlotFee,
  calculateApprovalFee,
  calculateApplicationFee,
  calculateExtensionFee,
  calculateCOCFee,
  getActiveConfig,
  isCommercialPlanType,
  isMultiStoryPlanType,
};
