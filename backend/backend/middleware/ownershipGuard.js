const { forbidden } = require('../utils/responseHelper');

/**
 * ownershipGuard — ensures an applicant can only access their own records.
 * Officers and admins are always allowed through.
 *
 * Usage:
 *   ownershipGuard('applicant_id')          — checks req.params.applicantId or req.body.applicant_id
 *   ownershipGuard.self()                   — route must include :userId param, checked against req.user.user_id
 *   ownershipGuard.application(Application) — resolves applicant_id from the Application record
 */

const OFFICER_ROLES = ['PSO','SW','TO','PHI','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

const isOfficer = (role) => OFFICER_ROLES.includes(role);

/**
 * Checks that req.user belongs to the applicant in req.params.applicantId
 * or that the user is an officer.
 */
const byApplicantParam = (req, res, next) => {
  if (!req.user) return forbidden(res, 'No user context');
  if (isOfficer(req.user.role)) return next();
  const paramId = req.params.applicantId || req.params.id;
  if (req.user.applicant_id && req.user.applicant_id !== paramId) {
    return forbidden(res, 'Access denied: not your record');
  }
  next();
};

/**
 * Checks req.params.userId === req.user.user_id (for self-profile routes).
 */
const self = (req, res, next) => {
  if (!req.user) return forbidden(res, 'No user context');
  if (isOfficer(req.user.role)) return next();
  if (req.params.userId && req.params.userId !== req.user.user_id) {
    return forbidden(res, 'Access denied: not your profile');
  }
  next();
};

/**
 * Resolves the application by reference number or application_id and checks
 * that the calling user is the applicant. Officers pass through.
 */
const forApplication = (Application) => async (req, res, next) => {
  if (!req.user) return forbidden(res, 'No user context');
  if (isOfficer(req.user.role)) return next();
  try {
    const where = req.params.ref
      ? { reference_number: req.params.ref }
      : { application_id: req.params.id };
    const app = await Application.findOne({ where });
    if (!app) return next(); // let the controller return 404
    // Compare against applicant_id stored in JWT (set during login for applicants)
    if (req.user.applicant_id && app.applicant_id !== req.user.applicant_id) {
      return forbidden(res, 'Access denied: not your application');
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { byApplicantParam, self, forApplication };
