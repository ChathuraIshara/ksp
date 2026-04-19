/**
 * Fee calculations matching KPS gazette schedule (PDF-specified rates)
 *
 * Building approval fees:  per sq.metre, banded by area
 * Boundary wall fees:      Rs. 100 per linear metre
 * COC fees:                base + overage structure
 * Extension fees:          Rs. 200/year residential, Rs. 400/year commercial
 * Land subdivision:        per-plot flat fee based on plot size band
 */

// ── Gazette Table 1: Building approval fee rates (Rs/sqm) ────────────────────
// Source: PDF spec — "Building Construction Fees" table
const BUILDING_FEE_RATES = [
  { maxSqm: 400,  singleStory: 20, multiStory: 25, nonResidential: 25 },
  { maxSqm: 1000, singleStory: 22, multiStory: 27, nonResidential: 27 },
  { maxSqm: 1500, singleStory: 25, multiStory: 30, nonResidential: 30 },
  { maxSqm: 2000, singleStory: 25, multiStory: 32, nonResidential: 32 },
];

/**
 * Calculate building approval fee per gazette.
 * @param {number} sqm  Total floor area in square metres
 * @param {boolean} isMultiStory  true = multi-story
 * @param {boolean} isNonResidential  true = commercial / industrial
 * @returns {number} Fee in Rs.
 */
const calculateBuildingFee = (sqm, isMultiStory = false, isNonResidential = false) => {
  const col = isNonResidential ? 'nonResidential' : isMultiStory ? 'multiStory' : 'singleStory';
  for (const band of BUILDING_FEE_RATES) {
    if (sqm <= band.maxSqm) return Math.round(sqm * band[col]);
  }
  // Above 2000 sqm: use the 2000 sqm band rate
  const topRate = BUILDING_FEE_RATES[BUILDING_FEE_RATES.length - 1][col];
  return Math.round(sqm * topRate);
};

// ── Sq.ft helper (some legacy callers pass sqft) ─────────────────────────────
const SQM_PER_SQFT = 0.092903;
const calculateBuildingFeeFromSqft = (sqft, isMultiStory = false, isNonResidential = false) =>
  calculateBuildingFee(sqft * SQM_PER_SQFT, isMultiStory, isNonResidential);

/**
 * Application form fee — Rs. 200 flat per application.
 */
const APPLICATION_FORM_FEE = 200;
const calculateApplicationFee = () => APPLICATION_FORM_FEE;

/**
 * Boundary wall fee: Rs. 100 per linear metre (PDF spec).
 * @param {number} lm  Wall length in linear metres
 */
const calculateWallFee = (lm) => Math.round(lm * 100);

/**
 * COC (Certificate of Conformity) fee per gazette.
 * Residential: Rs. 3,000 up to 3,225 sqft; Rs. 1/sqft over that.
 * Commercial:  Rs. 3,000 up to 1,075 sqft; Rs. 2/sqft over that.
 * (Kept in sqft as the gazette publishes COR fees in sqft)
 */
const calculateCOCFee = (sqft, isCommercial = false) => {
  const BASE_FEE = 3000;
  if (isCommercial) {
    const COMMERCIAL_BASE_SQFT = 1075;
    const COMMERCIAL_OVER_RATE = 2;
    if (sqft <= COMMERCIAL_BASE_SQFT) return BASE_FEE;
    return BASE_FEE + Math.round((sqft - COMMERCIAL_BASE_SQFT) * COMMERCIAL_OVER_RATE);
  } else {
    const RESIDENTIAL_BASE_SQFT = 3225;
    const RESIDENTIAL_OVER_RATE = 1;
    if (sqft <= RESIDENTIAL_BASE_SQFT) return BASE_FEE;
    return BASE_FEE + Math.round((sqft - RESIDENTIAL_BASE_SQFT) * RESIDENTIAL_OVER_RATE);
  }
};

/**
 * Time extension fee per gazette.
 * Residential: Rs. 200 per year. Commercial: Rs. 400 per year.
 */
const calculateExtensionFee = (isCommercial = false) => isCommercial ? 400 : 200;

/**
 * Land subdivision fee per plot based on plot size.
 * Source: PDF spec — "Land Subdivision Fees" table
 * @param {number} plotPerches  Size of the individual plot in perches
 * @returns {number} Fee per plot in Rs.
 */
const calculateSubdivisionFeePerPlot = (plotPerches) => {
  if (plotPerches <= 11.85)  return 1000;
  if (plotPerches <= 23.71)  return 800;
  if (plotPerches <= 35.57)  return 600;
  return 500; // Over 35.57 perches
};

/**
 * Plot fee (whole land approval — configurable, not in gazette).
 * Falls through to FeeConfiguration.rate_per_perch.
 */
const calculatePlotFee = (perches, ratePerPerch, flatFee = 0, minFee = 0) =>
  Math.max(Math.round(perches * ratePerPerch + flatFee), minFee);

/**
 * Telecom tower fee: Rs. 20,000 base (5–20m), + Rs. 100/m above 20m.
 */
const calculateTowerFee = (heightMetres) => {
  const BASE = 20000;
  const BASE_MAX_HEIGHT = 20;
  const EXTRA_PER_METRE = 100;
  if (heightMetres <= BASE_MAX_HEIGHT) return BASE;
  return BASE + Math.round((heightMetres - BASE_MAX_HEIGHT) * EXTRA_PER_METRE);
};

/**
 * Certified copy fee: Rs. 500 per copy.
 */
const calculateCertifiedCopyFee = (copies = 1) => copies * 500;

/**
 * Unauthorized construction fine — per db configuration rate.
 */
const calculateUnauthorizedFine = (sqft, penaltyRate) => Math.round(sqft * penaltyRate);

const calculateLateCORFine = (daysOverdue, dailyRate) => Math.round(daysOverdue * dailyRate);

module.exports = {
  calculateBuildingFee,
  calculateBuildingFeeFromSqft,
  calculateApplicationFee,
  calculateWallFee,
  calculateCOCFee,
  calculateExtensionFee,
  calculateSubdivisionFeePerPlot,
  calculateTowerFee,
  calculateCertifiedCopyFee,
  calculatePlotFee,
  calculateUnauthorizedFine,
  calculateLateCORFine,
  BUILDING_FEE_RATES,
  APPLICATION_FORM_FEE,
  SQM_PER_SQFT,
};
