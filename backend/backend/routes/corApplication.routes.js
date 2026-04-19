const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/corApplication.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['PSO','SW','TO','CHAIRMAN','ADMIN'];

router.post('/',                                    allowRoles('APPLICANT','PSO','ADMIN'), validate(validate.schemas.createCOR), ctrl.createCORApplication);
router.get('/ref/:ref',                             ctrl.getByRef);
router.get('/ref/:ref/check-late-fine',             ctrl.checkLateFine);
router.get('/ref/:ref/eligibility',                 allowRoles('APPLICANT', ...OFFICERS), ctrl.checkEligibilityByRef); // applicant checks own eligibility
router.post('/:id/photos',                          allowRoles('APPLICANT','ADMIN'), upload.array('photos', 20), ctrl.uploadCompletionPhotos);
router.put('/:id/compliance-statement',             allowRoles('APPLICANT','ADMIN'), validate(validate.schemas.complianceStatement), ctrl.addComplianceStatement);
router.get('/:id/check-eligibility',                allowRoles('APPLICANT', ...OFFICERS), ctrl.checkCOREligibility);
router.get('/:id/calculate-fee',                    allowRoles(...OFFICERS), ctrl.calculateCORFee);
router.put('/:id/link-late-fine',                   allowRoles('PSO','ADMIN'), ctrl.linkLateFine);
router.put('/:id/link-payment',                     allowRoles('APPLICANT','PSO','ADMIN'), ctrl.linkPayment);
router.put('/:id/status',                           allowRoles(...OFFICERS), ctrl.updateStatus);
router.post('/:id/schedule-inspection',             allowRoles('PSO','SW','TO','ADMIN'), ctrl.scheduleFinalInspection);
router.post('/:id/snapshot-deadline',               allowRoles('PSO','ADMIN'), ctrl.snapshotDeadline);

module.exports = router;
