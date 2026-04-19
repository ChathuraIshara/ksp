const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl   = require('../controllers/feeConfiguration.controller');
const auth   = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.post('/',                              allowRoles('ADMIN'), ctrl.createConfig);
router.get('/',                               ctrl.getAllActive);
router.get('/plan-type/:planTypeId',          ctrl.getByPlanType);
// Calculate routes MUST come before /:id (static before dynamic)
router.post('/calculate/building',            ctrl.calculateBuildingFee);
router.post('/calculate/plot',                ctrl.calculatePlotFee);
router.post('/calculate/wall',                ctrl.calculateWallFee);
router.get('/rate/unauthorized',             ctrl.getUnauthorizedRate);
router.post('/calculate/unauthorized-fine',   ctrl.calculateUnauthorizedFine);
router.post('/calculate/extension-fee',       ctrl.calculateExtensionFee);
router.post('/calculate/late-cor-fine',       ctrl.calculateLateCORFine);
router.get('/:id',                            ctrl.getById);           // ← FIXED: now calls getById
router.put('/:id',                            allowRoles('ADMIN'), ctrl.updateRates);
router.delete('/:id',                         allowRoles('ADMIN'), ctrl.deactivate);

module.exports = router;
