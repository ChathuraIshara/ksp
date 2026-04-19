const router = require('express').Router();
const ctrl = require('../controllers/document.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

// Applicants upload their own documents; officers verify/reject
router.post('/upload',                       upload.single('document'), ctrl.uploadDocument);
router.post('/upload/:appId',                 upload.single('document'), ctrl.uploadDocument);  // FE alias with appId in path
router.post('/validate',                     upload.single('document'), ctrl.validateFile);
router.get('/ref/:ref',                      ctrl.getByRef);
router.get('/ref/:ref/:category',            ctrl.getByCategory);
router.get('/:id',                           ctrl.getCurrentVersion);  // FE calls bare /:id — returns current version
router.delete('/:id',                        ctrl.deleteDocument);     // FE delete
router.get('/:id/current-version',           ctrl.getCurrentVersion);
router.get('/:id/version-history',           ctrl.getVersionHistory);
router.post('/:id/new-version',              upload.single('document'), ctrl.uploadNewVersion);
router.put('/:id/verify',                    allowRoles('PSO','SW','ADMIN'), ctrl.verifyDocument);
router.put('/:id/reject',                    allowRoles('PSO','SW','ADMIN'), ctrl.rejectDocument);
router.put('/:id/supersede',                 allowRoles('PSO','SW','ADMIN'), ctrl.markSuperseded);

module.exports = router;
