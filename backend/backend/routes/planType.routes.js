const router = require('express').Router();
const ctrl = require('../controllers/planType.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.post('/',                      allowRoles('ADMIN'), ctrl.createPlanType);
router.get('/',                       ctrl.getAllActive);
router.get('/:id',                    ctrl.getById);
router.get('/name/:name',             ctrl.getByName);
router.put('/:id',                    allowRoles('ADMIN'), ctrl.update);
router.delete('/:id',                 allowRoles('ADMIN'), ctrl.deactivate);
router.get('/:id/required-docs',      ctrl.getRequiredDocuments);
router.put('/:id/required-docs',      allowRoles('ADMIN'), ctrl.updateRequiredDocuments);
router.get('/:id/calculate-fee',      ctrl.calculateApplicationFee);

module.exports = router;
