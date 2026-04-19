const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/inspection.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

router.post('/',                        allowRoles(...OFFICERS), validate(validate.schemas.createInspection), ctrl.createInspection);
router.post('/priority',                allowRoles('SW','ADMIN'), ctrl.createPriorityInspection);
router.get('/ref/:ref',                 ctrl.getByRef);
router.get('/officer/:officerId',       allowRoles(...OFFICERS), ctrl.getByOfficer);
router.get('/:id',                      ctrl.getById);
router.put('/:id/schedule',             allowRoles('SW','TO','ADMIN'), validate(validate.schemas.scheduleInspection), ctrl.scheduleInspection);
router.put('/:id/reschedule',           allowRoles('SW','TO','ADMIN'), ctrl.rescheduleInspection);
router.put('/:id/confirm-attendance',   allowRoles('TO','ADMIN'), ctrl.confirmAttendance);
router.put('/:id/complete',             allowRoles('TO','ADMIN'), ctrl.completeInspection);
router.put('/:id/cancel',               allowRoles('SW','TO','ADMIN'), ctrl.cancelInspection);
router.post('/:id/save-offline',        allowRoles('TO','ADMIN'), ctrl.saveDraftOffline);
router.post('/:id/sync-offline',        allowRoles('TO','ADMIN'), ctrl.syncOfflineDraft);

// ── Slot negotiation ──────────────────────────────────────────────────────────
router.post('/:id/counter-slot',        allowRoles('APPLICANT','TO','ADMIN'), validate(validate.schemas.counterSlot), ctrl.proposeCounterSlot);
router.put('/:id/accept-slot',          allowRoles('APPLICANT','TO','ADMIN'), ctrl.acceptSlot);
router.get('/:id/negotiation-log',      ctrl.getNegotiationLog);

module.exports = router;
