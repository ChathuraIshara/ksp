const router = require('express').Router();
const ctrl = require('../controllers/applicant.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');
const { self, byApplicantParam } = require('../middleware/ownershipGuard');

router.use(auth);

// Officers/admin can create applicant profiles manually; applicants are created via /auth/register
router.post('/',               allowRoles('ADMIN','PSO'), ctrl.createApplicant);

// Applicant can read/update only their own profile; officers can read any
router.get('/:id',             byApplicantParam, ctrl.getById);
router.get('/user/:userId',    self, ctrl.getByUserId);
router.put('/:id',             byApplicantParam, ctrl.update);
router.post('/:id/photo',      byApplicantParam, upload.single('photo'), ctrl.uploadProfilePhoto);
router.get('/:id/history',     byApplicantParam, ctrl.getApplicationHistory);

module.exports = router;
