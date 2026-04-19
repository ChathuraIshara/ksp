const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/assessmentTax.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

router.post('/',                                          allowRoles('PSO','ADMIN'), validate(validate.schemas.createTaxRecord), ctrl.createRecord);
router.get('/search',                                     allowRoles(...OFFICERS), ctrl.searchByAddress);
router.get('/number/:taxNumber/pso-lookup',               allowRoles('PSO','ADMIN'), ctrl.psoLookup);
router.get('/pso-lookup/:taxNumber',                      allowRoles('PSO','ADMIN'), ctrl.psoLookup);  // FE alias
router.get('/lookup/:taxNumber',                          allowRoles('PSO','ADMIN'), ctrl.psoLookup); // frontend alias
router.get('/number/:taxNumber/has-complaints',           allowRoles(...OFFICERS), ctrl.hasActiveComplaints);
router.get('/number/:taxNumber',                          allowRoles(...OFFICERS), ctrl.getByTaxNumber);
router.get('/:id',                                        allowRoles(...OFFICERS), ctrl.getById);
router.put('/:id',                                        allowRoles('PSO','ADMIN'), ctrl.updateRecord);
router.put('/:id/update-tax-number',                      allowRoles('PSO','ADMIN'), ctrl.updateTaxNumber);
router.put('/:id/payment-status',                         allowRoles('PSO','ADMIN'), ctrl.updatePaymentStatus);
router.delete('/:id',                                     allowRoles('ADMIN'), ctrl.deactivate);
router.get('/:id/linked-applications',                    allowRoles(...OFFICERS), ctrl.getLinkedApplications);

module.exports = router;
