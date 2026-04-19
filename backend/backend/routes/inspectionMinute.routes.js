const router  = require('express').Router();
const ctrl    = require('../controllers/inspectionMinute.controller');
const auth    = require('../middleware/auth');
const upload  = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');
const { immutableGuard } = require('../middleware/immutableGuard');
const { InspectionMinute } = require('../models');
const validate = require('../middleware/validate');

router.use(auth);

const TO_ROLES  = ['TO','PHI','ADMIN'];
const READ_ROLES = ['PSO','SW','TO','PHI','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

router.post('/',                              allowRoles(...TO_ROLES), validate(validate.schemas.createMinute), ctrl.createMinute);
router.get('/inspection/:inspectionId',       allowRoles(...READ_ROLES), ctrl.getByInspection);
router.get('/ref/:ref',                       ctrl.getByRef);
router.get('/:id',                            ctrl.getById);
router.get('/:id/calculate-fee',              allowRoles(...TO_ROLES), ctrl.autoCalculateFee);
router.post('/:id/calculate-fee',             allowRoles(...TO_ROLES), ctrl.autoCalculateFee);  // FE uses POST
router.put('/:id/draft',                      allowRoles(...TO_ROLES), immutableGuard(InspectionMinute, 'id'), ctrl.saveDraft);
router.post('/:id/submit',                    allowRoles(...TO_ROLES), immutableGuard(InspectionMinute, 'id'), ctrl.submitMinute);
router.put('/:id/measurements',               allowRoles(...TO_ROLES), immutableGuard(InspectionMinute, 'id'), ctrl.addMeasurements);
router.put('/:id/compliance',                 allowRoles(...TO_ROLES), immutableGuard(InspectionMinute, 'id'), ctrl.setComplianceStatus);
router.put('/:id/setback',                    allowRoles(...TO_ROLES), immutableGuard(InspectionMinute, 'id'), ctrl.verifySetback);
router.put('/:id/height',                     allowRoles(...TO_ROLES), immutableGuard(InspectionMinute, 'id'), ctrl.verifyHeight);
router.put('/:id/far',                        allowRoles(...TO_ROLES), immutableGuard(InspectionMinute, 'id'), ctrl.verifyFAR);
router.post('/:id/flag-unauthorized',         allowRoles(...TO_ROLES), immutableGuard(InspectionMinute, 'id'), validate(validate.schemas.flagUnauthorized), ctrl.flagUnauthorizedConstruction);
router.post('/:id/photos',                    allowRoles(...TO_ROLES), upload.array('photos', 20), immutableGuard(InspectionMinute, 'id'), ctrl.uploadPhotos);
router.post('/:id/sync',                      allowRoles(...TO_ROLES), ctrl.syncOfflineDraft);
// Edit a submitted minute — snapshots previous values into tracking line before overwriting
router.put('/:id/edit-submitted',             allowRoles(...TO_ROLES), ctrl.editSubmittedMinute);
router.put('/:id/lock',                       allowRoles('SW','CHAIRMAN','ADMIN'), ctrl.lockMinute);

module.exports = router;
