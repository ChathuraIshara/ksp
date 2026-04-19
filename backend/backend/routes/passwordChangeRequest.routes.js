const router = require('express').Router();
const auth   = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');
const ctrl   = require('../controllers/passwordChangeRequest.controller');

const ALL_OFFICERS = ['PSO','SW','TO','PHI','HO','RDA','GJS','UDA','CHAIRMAN'];
const ALL_USERS    = [...ALL_OFFICERS, 'APPLICANT'];

router.use(auth);

// Officer/Applicant routes
router.post('/',         allowRoles(...ALL_USERS), ctrl.createRequest);
router.get('/my',        allowRoles(...ALL_USERS), ctrl.myRequest);

// Admin only
router.get('/',          allowRoles('ADMIN'), ctrl.listPending);
router.put('/:id/approve', allowRoles('ADMIN'), ctrl.approve);
router.put('/:id/reject',  allowRoles('ADMIN'), ctrl.reject);

module.exports = router;
