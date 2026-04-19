const router = require('express').Router();
const ctrl = require('../controllers/taxOwner.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['PSO','SW','TO','HO','CHAIRMAN','ADMIN'];

router.post('/tax-records/:id/owners',                          allowRoles('PSO','ADMIN'), ctrl.createOwner);
router.get('/tax-records/:id/owners',                           allowRoles(...OFFICERS), ctrl.getOwnersByTaxRecord);
router.get('/tax-records/:id/owners/current',                   allowRoles(...OFFICERS), ctrl.getCurrentOwners);
router.get('/tax-records/:id/owners/primary',                   allowRoles(...OFFICERS), ctrl.getPrimaryOwner);
router.put('/tax-records/:id/owners/:ownerId',                  allowRoles('PSO','ADMIN'), ctrl.updateOwner);
router.delete('/tax-records/:id/owners/:ownerId',               allowRoles('PSO','ADMIN'), ctrl.deactivateOwner);
router.get('/tax-records/number/:taxNumber/verify-name',        allowRoles(...OFFICERS), ctrl.verifyNameMatch);

module.exports = router;
