const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/queue.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.get('/',                         ctrl.getAllActiveQueues);
router.get('/online',                   allowRoles('PSO','ADMIN'), ctrl.getOnlineQueue);
router.get('/manual',                   allowRoles('PSO','ADMIN'), ctrl.getManualQueue);
router.get('/count',                    ctrl.getQueueCount);
router.get('/:type/applications',       ctrl.getQueueByType);
router.get('/:queueId/items',           ctrl.getQueueApplications);
router.post('/assign',                  validate(validate.schemas.assignToQueue), ctrl.assignToQueue);
router.put('/:assignmentId/resolve',    ctrl.resolveQueueItem);
router.put('/reorder',                  ctrl.reorderQueue);

// ── Frontend alias routes ──────────────────────────────────────────────────
router.get('/assignments',              ctrl.getQueueApplications);   // FE: GET /queues/assignments
router.get('/type/:type',               ctrl.getQueueByType);         // FE: GET /queues/type/:type

module.exports = router;
