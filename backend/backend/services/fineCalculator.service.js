const { FeeConfiguration } = require('../models');
const { Op } = require('sequelize');

const calculateUnauthorizedFine = async (sqft, planTypeId) => {
  const cfg = await FeeConfiguration.findOne({
    where: { plan_type_id: planTypeId, fee_type: 'FINE', is_active: true },
  });
  if (!cfg) throw new Error('No fine configuration found');
  return sqft * (cfg.penalty_rate_per_sqft || 0);
};

/**
 * Calculate late COR fine.
 * Uses the global LATE_COR FeeConfiguration row (plan_type_id IS NULL).
 * Falls back to Rs. 50/day if no config row exists so it never silently returns 0.
 *
 * Spec: "if it exceeds five years time after approval it should calculate fine"
 */
const calculateLateCORFine = async (daysOverdue) => {
  const cfg = await FeeConfiguration.findOne({
    where: {
      fee_type:  'LATE_COR',
      is_active: true,
      [Op.or]: [{ plan_type_id: null }, { plan_type_id: { [Op.is]: null } }],
    },
  });

  // Default daily rate: Rs. 50/day if no config row seeded yet
  const DEFAULT_DAILY_RATE = 50;
  const dailyRate = cfg
    ? Number(cfg.rate_per_sqft || cfg.flat_fee || DEFAULT_DAILY_RATE)
    : DEFAULT_DAILY_RATE;

  return Math.round(daysOverdue * dailyRate);
};

module.exports = { calculateUnauthorizedFine, calculateLateCORFine };
