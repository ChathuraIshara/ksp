const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl   = require('../controllers/psoVerification.controller');
const auth   = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);
router.use(allowRoles('PSO','ADMIN'));

router.post('/log',                   ctrl.createLog);          // ← MUST be before /:ref
router.post('/',                      validate(validate.schemas.performVerification), ctrl.performVerification);  // bare POST — ref in body
router.post('/:ref',                  validate(validate.schemas.performVerification), ctrl.performVerification);  // legacy path param form
router.get('/:ref/history',           ctrl.getLogsByRef);
router.put('/:id/name-match',         ctrl.updateNameMatchResult);
router.put('/:id/doc-check',          ctrl.updateDocumentCheckResult);
router.put('/:id/complaint-flag',     ctrl.setComplaintFlag);
router.put('/:id/action',             ctrl.recordActionTaken);
router.put('/:id/flag-complaint',     ctrl.flagComplaint);

module.exports = router;
