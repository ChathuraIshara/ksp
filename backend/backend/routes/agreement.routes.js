const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/agreement.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['PSO','SW','HO','RDA','GJS','CHAIRMAN','ADMIN'];

router.post('/',                              allowRoles(...OFFICERS), validate(validate.schemas.createAgreement), ctrl.createAgreement);
router.get('/approval/:approvalId',           allowRoles(...OFFICERS), ctrl.getByApproval);
router.get('/ref/:ref',                       ctrl.getByRef);
router.post('/:id/upload',                    allowRoles('RDA','ADMIN'), upload.single('agreement'), ctrl.uploadSignedAgreement);
router.get('/:id/verify-waiver',              allowRoles(...OFFICERS), ctrl.verifyWaiverUploaded);
router.put('/:id/sign-applicant',             allowRoles('APPLICANT','ADMIN'), ctrl.recordApplicantSignature);
router.put('/:id/sign-officer',               allowRoles(...OFFICERS), ctrl.recordOfficerSignature);
router.get('/:id/both-signed',                allowRoles(...OFFICERS), ctrl.verifyBothSigned);
router.put('/:id/link-conversation',          allowRoles(...OFFICERS), ctrl.linkConversation);
router.post('/:id/notify-for-signing',        allowRoles(...OFFICERS), ctrl.notifyForSigning);

module.exports = router;
