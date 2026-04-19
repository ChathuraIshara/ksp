const router = require('express').Router();
const ctrl = require('../controllers/toAvailability.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

// TO manages their own availability
router.get('/my-calendar',                         allowRoles('TO'), ctrl.getMyCalendar);
router.post('/set',                                allowRoles('TO'), ctrl.setAvailability);
router.post('/',                                   allowRoles('TO'), ctrl.setAvailability);  // FE alias

// SW checks before assigning
router.get('/available/:date',                     allowRoles('SW','PSO','ADMIN'), ctrl.getAvailableTOs);
router.get('/:officer_id/:date',                   allowRoles('SW','PSO','TO','ADMIN'), ctrl.checkAvailability);
router.post('/book-slot',                          allowRoles('SW','ADMIN'), ctrl.bookSlot);

module.exports = router;
