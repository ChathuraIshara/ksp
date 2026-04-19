const router  = require('express').Router();
const ctrl    = require('../controllers/decision.controller');
const auth    = require('../middleware/auth');
const { allowRoles }     = require('../middleware/roleGuard');
const { immutableGuard } = require('../middleware/immutableGuard');
const { Decision } = require('../models');
const validate = require('../middleware/validate');

router.use(auth);

const READ_ROLES = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];
const PC_WRITE   = ['CHAIRMAN','ADMIN'];

router.post('/',                          allowRoles(...PC_WRITE), validate(validate.schemas.createDecision), ctrl.createDecision);
router.get('/ref/:ref',                   allowRoles(...READ_ROLES), ctrl.getByRef);
router.get('/meeting/:meetingId',         allowRoles(...READ_ROLES), ctrl.getByMeeting);
router.get('/type/:type',                 allowRoles(...READ_ROLES), ctrl.getByType);
router.put('/:id/conditions',             allowRoles(...PC_WRITE), immutableGuard(Decision, 'id'), ctrl.documentConditions);
router.put('/:id/rejection-reason',       allowRoles(...PC_WRITE), immutableGuard(Decision, 'id'), ctrl.documentRejectionReason);
router.put('/:id/further-review',         allowRoles(...PC_WRITE), immutableGuard(Decision, 'id'), ctrl.documentFurtherReview);
router.post('/:id/handle-further-review', allowRoles(...PC_WRITE), immutableGuard(Decision, 'id'), ctrl.handleFurtherReview);
router.put('/:id/defer',                  allowRoles(...PC_WRITE), immutableGuard(Decision, 'id'), validate(validate.schemas.deferDecision), ctrl.deferToNextMeeting);
router.put('/:id/uda-minute',             allowRoles('UDA','ADMIN'), immutableGuard(Decision, 'id'), ctrl.linkUDAMinute);
router.put('/:id/approval-fee',           allowRoles(...PC_WRITE), immutableGuard(Decision, 'id'), ctrl.setApprovalFee);
router.put('/:id/votes',                  allowRoles(...PC_WRITE), immutableGuard(Decision, 'id'), ctrl.recordVotes);
router.post('/:id/notify-applicant',      allowRoles(...PC_WRITE), ctrl.notifyApplicant);
router.post('/:id/generate-certificate',  allowRoles(...PC_WRITE), ctrl.generateCertificate);
router.put('/:id/lock',                   allowRoles(...PC_WRITE), ctrl.lockDecision);

module.exports = router;
