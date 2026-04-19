const router = require('express').Router();
const ctrl = require('../controllers/taxOwnerHistory.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['PSO','SW','CHAIRMAN','ADMIN'];

router.post('/',                                      allowRoles('PSO','ADMIN'), ctrl.createHistory);
router.get('/tax-records/:id/owner-history',         allowRoles(...OFFICERS), ctrl.getByTaxRecord);
router.get('/tax-records/:id/owner-history/audit',   allowRoles('PSO','CHAIRMAN','ADMIN'), ctrl.auditNameChanges);
router.get('/owner/:ownerId',                         allowRoles(...OFFICERS), ctrl.getByOwner);
router.get('/ref/:ref',                               allowRoles(...OFFICERS), ctrl.getByApplication);
router.post('/:id/proof-document',                    allowRoles('PSO','ADMIN'), upload.single('proof'), ctrl.uploadProofDocument);

module.exports = router;
