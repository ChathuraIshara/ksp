const router = require('express').Router();
const ctrl = require('../controllers/finalInspection.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const TO_ROLES = ['TO','ADMIN'];
const READ_ROLES = ['PSO','SW','TO','CHAIRMAN','ADMIN'];

router.post('/',                                     allowRoles('PSO','SW','ADMIN'), ctrl.createFinalInspection);
router.get('/ref/:ref',                              allowRoles(...READ_ROLES), ctrl.getByRef);
router.get('/:id',                                   allowRoles(...READ_ROLES), ctrl.getById);
router.get('/cor/:corId',                            allowRoles(...READ_ROLES), ctrl.getByCOR);
router.put('/:id/schedule',                          allowRoles('PSO','SW','ADMIN'), ctrl.scheduleFinalInspection);
router.put('/:id/conduct',                           allowRoles(...TO_ROLES), ctrl.conductInspection);
router.put('/:id/compliance',                        allowRoles(...TO_ROLES), ctrl.assessCompliance);
router.put('/:id/deviations',                        allowRoles(...TO_ROLES), ctrl.documentDeviations);
router.post('/:id/photos',                           allowRoles(...TO_ROLES), upload.array('photos', 20), ctrl.uploadPhotos);
router.post('/:id/submit',                           allowRoles(...TO_ROLES), ctrl.submitReport);
router.post('/:id/handle-major-deviation',           allowRoles(...TO_ROLES), ctrl.handleMajorDeviation);
router.post('/:id/reschedule-after-correction',      allowRoles('PSO','SW','ADMIN'), ctrl.rescheduleAfterCorrection);
router.post('/:id/sync',                             allowRoles(...TO_ROLES), ctrl.syncOfflineDraft);
router.put('/:id/compare-plan',                      allowRoles(...TO_ROLES), ctrl.compareWithApprovedPlan);
router.post('/:id/save-offline',                     allowRoles(...TO_ROLES), ctrl.saveDraftOffline);

module.exports = router;
