const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/complaint.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');

// Public route — unauthenticated complaint submission
router.post('/public', validate(validate.schemas.publicComplaint), ctrl.createPublicComplaint);

router.use(auth);

const OFFICERS = ['PSO','SW','TO','HO','CHAIRMAN','ADMIN'];

router.post('/',                               allowRoles(...OFFICERS,'APPLICANT'), validate(validate.schemas.createComplaint), ctrl.createComplaint);
router.get('/pending',                         allowRoles(...OFFICERS), ctrl.getPending);
router.get('/status/:status',                  allowRoles(...OFFICERS), ctrl.getByStatus);
router.get('/tax/:taxNumber',                  allowRoles(...OFFICERS), ctrl.getByTaxNumber);
router.get('/ref/:ref',                        ctrl.getByRef);
router.get('/:id',                             ctrl.getById);
router.put('/:id/assign',                      allowRoles('PSO','CHAIRMAN','ADMIN'), ctrl.assignToOfficer);
router.post('/:id/evidence',                   upload.single('evidence'), ctrl.uploadEvidence);
router.put('/:id/status',                      allowRoles(...OFFICERS), ctrl.updateStatus);
router.put('/:id/resolve',                     allowRoles(...OFFICERS), validate(validate.schemas.resolveComplaint), ctrl.resolveComplaint);
router.post('/:id/resolve',                    allowRoles(...OFFICERS), ctrl.resolveComplaint);  // FE uses POST
router.put('/:id/dismiss',                     allowRoles('CHAIRMAN','ADMIN'), ctrl.dismissComplaint);
router.post('/:id/send-initial-notifications', allowRoles(...OFFICERS), ctrl.sendInitialNotifications);
router.post('/:id/send-reminder',              allowRoles(...OFFICERS), ctrl.sendWeeklyReminder);
router.get('/:id/reminder-schedule',           allowRoles(...OFFICERS), ctrl.checkReminderSchedule);
router.put('/:id/resolution-minute',           allowRoles(...OFFICERS), ctrl.linkResolutionMinute);

module.exports = router;
