const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/taskAssignment.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['PSO','SW','TO','CHAIRMAN','ADMIN'];

router.post('/',                              allowRoles('SW','PSO','ADMIN'), validate(validate.schemas.createTask), ctrl.createTask);
router.get('/sw-dashboard',                   allowRoles('SW','ADMIN'), ctrl.getSWDashboard);
router.get('/mine',                           allowRoles(...OFFICERS), ctrl.getMyTasks);
router.get('/overdue',                        allowRoles(...OFFICERS), ctrl.checkOverdueTasks);
router.get('/officer/:officerId',             allowRoles(...OFFICERS), ctrl.getByOfficer);
router.get('/officer/:officerId/workload',    allowRoles(...OFFICERS), ctrl.getWorkloadByOfficer);
router.get('/ref/:ref',                       allowRoles(...OFFICERS), ctrl.getByRef);
router.get('/application/:applicationId',     allowRoles(...OFFICERS), ctrl.getByApplicationId);
router.get('/status/:status',                 allowRoles(...OFFICERS), ctrl.getByStatus);
router.put('/:id/status',                     allowRoles(...OFFICERS), ctrl.updateStatus);
router.put('/:id/complete',                   allowRoles('TO','SW','ADMIN'), ctrl.completeTask);
router.put('/:id/reassign',                   allowRoles('SW','ADMIN'), ctrl.reassignTask);
router.post('/snapshot-workload',             allowRoles('SW','ADMIN'), ctrl.snapshotWorkload);

module.exports = router;
