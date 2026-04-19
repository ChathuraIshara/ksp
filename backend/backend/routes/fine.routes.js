const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/fine.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.post('/',                         validate(validate.schemas.createFine), ctrl.createFine);
router.get('/ref/:ref',                  ctrl.getByRef);
router.get('/status/:status',            ctrl.getByStatus);
router.put('/:id/waive',                 allowRoles('CHAIRMAN','ADMIN'), ctrl.waiveFine);
router.put('/:id/link-payment',          ctrl.linkPayment);
router.put('/:id/pay',                   ctrl.linkPayment);
router.post('/:id/notify-all',           ctrl.notifyAll);
router.get('/ref/:ref/total',            ctrl.getTotalFinesByRef);
router.post('/calculate/unauthorized',   ctrl.calculateUnauthorizedFine);
router.post('/calculate/late-cor',       ctrl.calculateLateCORFine);
router.put('/:id/payment-status',        ctrl.updatePaymentStatus);

module.exports = router;
