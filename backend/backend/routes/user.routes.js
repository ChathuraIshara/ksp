const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl   = require('../controllers/user.controller');
const auth   = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

router.get('/',           allowRoles('PSO','ADMIN'), ctrl.listByRole);
router.put('/password',   validate(validate.schemas.changePassword), ctrl.changePassword);          // ← MUST be before /:id
router.get('/:id',        ctrl.getProfile);
router.put('/:id',        ctrl.updateProfile);
router.put('/:id/status', allowRoles('ADMIN'), ctrl.updateStatus);
router.delete('/:id',     allowRoles('ADMIN'), ctrl.deleteUser);

module.exports = router;
