const router = require('express').Router();
const ctrl = require('../controllers/pcAttendee.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const PC_ROLES = ['CHAIRMAN','ADMIN'];
const READ_ROLES = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

router.post('/meetings/:id/attendees',                             allowRoles(...PC_ROLES), ctrl.addAttendee);
router.get('/meetings/:id/attendees',                              allowRoles(...READ_ROLES), ctrl.getByMeeting);
router.put('/meetings/:id/attendees/:attendeeId/attendance',      allowRoles(...PC_ROLES), ctrl.updateAttendanceStatus);
router.put('/meetings/:id/attendees/:attendeeId/notes',           allowRoles(...READ_ROLES), ctrl.saveMemberNotes);
router.get('/meetings/:id/quorum',                                 allowRoles(...READ_ROLES), ctrl.verifyQuorum);
router.delete('/meetings/:id/attendees/:attendeeId',              allowRoles(...PC_ROLES), ctrl.removeAttendee);
router.get('/officer/:officerId',                                  allowRoles(...READ_ROLES), ctrl.getByOfficer);
router.put('/meetings/:id/attendees/:attendeeId/record',          allowRoles(...PC_ROLES), ctrl.recordAttendance);

module.exports = router;
