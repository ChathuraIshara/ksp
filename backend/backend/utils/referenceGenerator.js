/**
 * referenceGenerator.js
 *
 * Fix: Reference numbers now include plan type prefix for quick identification.
 *
 * Format: KPS-{TYPE}-{YEAR}-{SEQUENCE}
 *   KPS-BP-2026-0001  →  Building Plan
 *   KPS-PL-2026-0001  →  Plot of Land
 *   KPS-BW-2026-0001  →  Boundary Wall
 *   KPS-GN-2026-0001  →  General / unknown type
 */

const { Application } = require('../models');
const { Op }          = require('sequelize');

const PLAN_TYPE_PREFIX = {
  BUILDING_PLAN:   'BP',
  BUILDING:        'BP',
  PLOT_OF_LAND:    'PL',
  PLOT:            'PL',
  BOUNDARY_WALL:   'BW',
  WALL:            'BW',
};

const getPlanTypePrefix = (category) => {
  if (!category) return 'GN';
  const key = category.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return PLAN_TYPE_PREFIX[key] || 'GN';
};

/**
 * Generate a unique reference number.
 * @param {string} planTypeCategory  e.g. 'BUILDING_PLAN', 'PLOT_OF_LAND', 'BOUNDARY_WALL'
 * @returns {string}  e.g. 'KPS-BP-2026-0042'
 */
const generateReferenceNumber = async (planTypeCategory = null) => {
  const { sequelize } = require('../models');
  const year   = new Date().getFullYear();
  const prefix = getPlanTypePrefix(planTypeCategory);

  // Use a serializable transaction to prevent race conditions under concurrent requests.
  // Without this, two simultaneous requests could both count the same total and
  // generate duplicate reference numbers.
  return sequelize.transaction({ isolationLevel: require('sequelize').Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (t) => {
    const count = await Application.count({
      where: { reference_number: { [Op.like]: `KPS-${prefix}-${year}-%` } },
      transaction: t,
      lock: true,
    });
    const seq = String(count + 1).padStart(4, '0');
    return `KPS-${prefix}-${year}-${seq}`;
  });
};

module.exports = { generateReferenceNumber, getPlanTypePrefix };
