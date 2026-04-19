const router = require('express').Router();
const ctrl = require('../controllers/printLog.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.get('/certificate/:certificateId',              ctrl.getByContent);
router.get('/certificate/:certificateId/latest-number', ctrl.getLatestPrintNumber);
router.post('/validate',                               ctrl.validatePrintPermission);
router.put('/:id/reason',                              ctrl.updateReason);
router.post('/:id/notify-chairman',                    ctrl.notifyChairmanOnReprint);
router.get('/:id/is-first-print',                     ctrl.isFirstPrint);

module.exports = router;
