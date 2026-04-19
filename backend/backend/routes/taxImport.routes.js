const router = require('express').Router();
const upload = require('../middleware/uploadHandler');
const ctrl = require('../controllers/taxImport.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

const csvUpload = upload.csv;

router.use(auth);
router.use(allowRoles('ADMIN','PSO'));

router.post('/upload',   csvUpload.single('file'), ctrl.bulkImportTaxRecords);
router.post('/validate', csvUpload.single('file'), ctrl.validateImportFile);
router.post('/preview',  csvUpload.single('file'), ctrl.previewImport);
router.post('/confirm',  csvUpload.single('file'), ctrl.confirmImport);
router.get('/history',   ctrl.getImportHistory);

module.exports = router;