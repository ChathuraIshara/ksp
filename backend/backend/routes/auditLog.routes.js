const router = require('express').Router();
const ctrl = require('../controllers/auditLog.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.get('/',                   allowRoles('ADMIN'), ctrl.searchLogs);
router.get('/ref/:ref',           ctrl.getByRef);
router.get('/user/:userId',       ctrl.getByUser);
router.get('/action/:action',     allowRoles('ADMIN'), ctrl.getByAction);
router.get('/date-range',         allowRoles('ADMIN'), ctrl.getByDateRange);
router.post('/export',            allowRoles('ADMIN'), ctrl.exportLogs);
router.post('/log',               ctrl.logAction);

module.exports = router;
