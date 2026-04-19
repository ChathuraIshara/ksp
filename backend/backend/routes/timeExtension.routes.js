const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/timeExtension.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.post('/',                              validate(validate.schemas.createExtension), ctrl.createExtension);
router.get('/ref/:ref',                       ctrl.getByRef);
router.get('/status/:status',                 ctrl.getByStatus);
router.get('/ref/:ref/calculate-fee',         ctrl.calculateExtensionFee);
router.get('/ref/:ref/latest-deadline',       ctrl.getLatestDeadline);
router.get('/ref/:ref/eligibility',           ctrl.checkExtensionEligibility);
router.get('/:id',                            ctrl.getById);
router.put('/:id/approve',                    allowRoles('CHAIRMAN','SW','ADMIN'), ctrl.approveExtension);
router.put('/:id/reject',                     allowRoles('CHAIRMAN','SW','ADMIN'), validate(validate.schemas.rejectExtension), ctrl.rejectExtension);
router.put('/:id/link-payment',               ctrl.linkPayment);
router.put('/:id/deadline',                   ctrl.updateDeadline);
router.post('/:id/notify-applicant',         ctrl.notifyApplicant);

module.exports = router;
