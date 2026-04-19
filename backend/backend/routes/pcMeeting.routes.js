const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/pcMeeting.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

// ── Static and prefix routes FIRST (before /:id to avoid param shadowing) ────
router.post('/',                              allowRoles('CHAIRMAN','ADMIN'), validate(validate.schemas.createMeeting), ctrl.createMeeting);
router.get('/',                               ctrl.listAll);
router.get('/upcoming',                       ctrl.getUpcoming);
router.get('/completed',                      ctrl.getCompleted);

// ── Voting routes BEFORE /:id (votes/cast and votes/:decisionId would be
//    swallowed by /:id if placed after it) ─────────────────────────────────────
router.post('/votes/cast',                    allowRoles('CHAIRMAN','SW','TO','HO','RDA','GJS','UDA','PHI','ADMIN'), validate(validate.schemas.castVote), ctrl.castVote);
router.get('/votes/:decisionId/outcome',      allowRoles('CHAIRMAN','ADMIN'), ctrl.computeMajorityOutcome);
router.get('/votes/:decisionId',              allowRoles('CHAIRMAN','SW','TO','HO','RDA','GJS','UDA','PHI','ADMIN'), ctrl.getVoteTally);

// ── Dynamic :id routes LAST ───────────────────────────────────────────────────
router.get('/:id',                            ctrl.getById);
router.put('/:id',                            allowRoles('CHAIRMAN','ADMIN'), ctrl.updateMeeting);
router.put('/:id/agenda',                     ctrl.updateAgenda);
router.post('/:id/add-application',           ctrl.addToAgenda);
// PDF: every PC meeting member can add their own minute on each application in the meeting
router.post('/:id/applications/:appId/minute', allowRoles('PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'), ctrl.addPCMeetingMinute);
router.put('/:id/complete',                   allowRoles('CHAIRMAN','ADMIN'), ctrl.completeMeeting);
router.put('/:id/cancel',                     allowRoles('CHAIRMAN','ADMIN'), ctrl.cancelMeeting);
router.post('/:id/notify-attendees',          ctrl.notifyAllAttendees);

module.exports = router;
