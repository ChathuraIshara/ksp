const router  = require('express').Router();
const ctrl    = require('../controllers/externalApproval.controller');
const auth    = require('../middleware/auth');
const upload  = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.use(auth);

const OFFICERS = ['PSO','SW','HO','RDA','GJS','CHAIRMAN','ADMIN'];

// Forward external approval result back to SW for PC meeting prep
router.post('/:id/forward-to-sw',             allowRoles('SW','ADMIN'), ctrl.forwardToSW);
router.post('/forward',                       allowRoles('SW','ADMIN'), ctrl.forwardToExternalOfficer);
router.get('/ref/:ref',                       allowRoles(...OFFICERS), ctrl.getByRef);
router.get('/ref/:ref/all-complete',          allowRoles(...OFFICERS), ctrl.checkAllApprovalsComplete);
router.get('/officer/mine',                   allowRoles(...OFFICERS), ctrl.getMyApprovals);   // FE: listForGJS/HO/RDA
router.get('/officer/:officerId',             allowRoles(...OFFICERS), ctrl.getByOfficer);
router.get('/status/:status',                 allowRoles(...OFFICERS), ctrl.getByStatus);
router.post('/:id/upload-waiver',             allowRoles('RDA','ADMIN'), upload.single('waiver'), ctrl.uploadRDAWaiver);
router.put('/:id/submit',                     allowRoles('HO','RDA','GJS','ADMIN'), validate(validate.schemas.submitApproval), ctrl.submitApproval);
router.put('/:id/link-minute',                allowRoles(...OFFICERS), ctrl.linkMinute);
router.post('/:id/minute',                    upload.single('document'), allowRoles('HO','RDA','GJS','PHI','ADMIN'), ctrl.uploadExternalMinute);  // FE alias
router.post('/:id/submit-minute',             allowRoles('HO','RDA','GJS','PHI','ADMIN'), ctrl.submitExternalMinute);  // FE alias
router.put('/:id/mark-returned',              allowRoles('HO','RDA','GJS','ADMIN'), ctrl.markReturned);
router.post('/:id/notify-officer',            allowRoles('SW','PSO','ADMIN'), ctrl.notifyOfficer);
router.post('/',                              allowRoles('SW','ADMIN'), ctrl.createApproval);

module.exports = router;
