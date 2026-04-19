const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/officer.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.post('/',                           validate(validate.schemas.createOfficer), ctrl.createOfficer);
router.get('/',                            ctrl.listAll);             // GET /officers?role=TO&user_id=xxx
router.get('/pending',                     allowRoles('ADMIN'), ctrl.listPendingVerifications);
router.get('/:id',                         ctrl.getById);
router.get('/user/:userId',                ctrl.getByUserId);
router.put('/:id',                         ctrl.update);
router.put('/:id/verify',                  allowRoles('ADMIN'), ctrl.verifyOfficer);
router.put('/:id/reject',                  allowRoles('ADMIN'), ctrl.rejectOfficer);
router.get('/:id/workload',                ctrl.getWorkloadScore);
router.get('/:id/workload-score',           ctrl.getWorkloadScore);   // FE alias
router.get('/:id/active-task-count',       ctrl.getActiveTaskCount);

module.exports = router;
