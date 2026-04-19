const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/appeal.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

// Applicants submit appeals; officers review them
router.post('/',                              allowRoles('APPLICANT','PSO','ADMIN'), validate(validate.schemas.createAppeal), ctrl.createAppeal);
router.get('/ref/:ref',                       ctrl.getByRef);
router.get('/status/:status',                 allowRoles(...OFFICERS), ctrl.getByStatus);
router.get('/ref/:ref/current-round',         ctrl.getCurrentRound);
router.post('/:id/revised-docs',              allowRoles('APPLICANT','ADMIN'), upload.array('files', 10), ctrl.uploadRevisedDocuments);
router.post('/:id/supporting-docs',           allowRoles('APPLICANT','ADMIN'), upload.array('files', 10), ctrl.uploadSupportingDocuments);
router.post('/:id/submit',                    allowRoles('APPLICANT','ADMIN'), ctrl.submitAppeal);
// PDF: submitted appeal escalates directly to TO workload (bypasses PSO queue)
router.post('/:id/escalate-to-to',            allowRoles('SW','CHAIRMAN','ADMIN'), ctrl.escalateToTO);
router.put('/:id/link-payment',               allowRoles('APPLICANT','PSO','ADMIN'), ctrl.linkPayment);
router.put('/:id/status',                     allowRoles(...OFFICERS), ctrl.updateStatus);
router.put('/:id/decision',                   allowRoles('CHAIRMAN','ADMIN'), validate(validate.schemas.appealDecision), ctrl.recordDecision);
router.post('/:id/create-nodes',              allowRoles('SW','CHAIRMAN','ADMIN'), ctrl.createAppealNodes);
router.post('/:id/notify-applicant',          allowRoles(...OFFICERS), ctrl.notifyApplicant);
router.post('/:id/notify-sw',                 allowRoles('PSO','CHAIRMAN','ADMIN'), ctrl.notifySW);

module.exports = router;
