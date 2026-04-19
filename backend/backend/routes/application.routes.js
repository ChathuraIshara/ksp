const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/application.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');
const { forApplication } = require('../middleware/ownershipGuard');
const { Application } = require('../models');

const ownApp = forApplication(Application);

router.use(auth);

// Applicants create their own; officers read/manage
router.post('/',                          allowRoles('APPLICANT','PSO','ADMIN'), validate(validate.schemas.createApplication), ctrl.createApplication);
// PSO registers a walk-in applicant — no prior account needed
router.post('/walk-in',                    allowRoles('PSO','ADMIN'), ctrl.createWalkInApplication);

// Applicant: my own applications
router.get('/',                           allowRoles('PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'), ctrl.listAll);
router.get('/my',                         allowRoles('APPLICANT'), ctrl.myApplications);

// Officer-only bulk views
router.get('/with-flags',                 allowRoles('PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'), ctrl.getApplicationsWithFlags);
router.get('/status/:status',             allowRoles('PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'), ctrl.getByStatus);
router.get('/search',                     allowRoles('PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'), ctrl.search);

// Role-scoped queue views
router.get('/pso/queue',                  allowRoles('PSO','ADMIN'), ctrl.getPSOQueue);
router.get('/sw/assigned',                allowRoles('SW','ADMIN'), ctrl.getSWAssigned);
router.get('/to/assigned',                allowRoles('TO','ADMIN'), ctrl.getTOAssigned);

// Applicant can only see their own applications
router.get('/applicant/:applicantId',     ctrl.getByApplicant);       // controller checks applicant_id matches
router.get('/tax/:taxNumber',             allowRoles('PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'), ctrl.getByTaxNumber);
router.get('/:ref',                       ownApp, ctrl.getByRef);

// Status / stage mutations — officers only
router.put('/:ref/status',                allowRoles('PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'), validate(validate.schemas.updateApplicationStatus), ctrl.updateStatus);
router.put('/:ref/stage',                 allowRoles('PSO','SW','ADMIN'), ctrl.updateStage);
// PDF: PSO can edit application details when in NAME_MISMATCH queue
router.put('/:ref/pso-edit',              allowRoles('PSO','ADMIN'), ctrl.psoEditApplication);
router.post('/:ref/generate-ref',         allowRoles('PSO','ADMIN'), ctrl.generateReferenceNumber);
router.post('/:ref/ref-receipt',          allowRoles('PSO','ADMIN'), ctrl.generateAndSaveRefReceipt);
router.post('/:ref/forward-to-sw',        allowRoles('PSO','ADMIN'), ctrl.forwardToSW);
router.post('/:applicationId/sw-review-submit', allowRoles('SW','ADMIN'), ctrl.swReviewSubmit);
router.get('/:ref/payment-clearance',     allowRoles('PSO','SW','ADMIN'), ctrl.checkPaymentClearance);
router.get('/:ref/expiry-status',         ctrl.checkExpiryStatus);
router.post('/:ref/send-expiry-reminder', allowRoles('ADMIN'), ctrl.sendExpiryReminder);
router.put('/:ref/apply-late-fine',       allowRoles('PSO','SW','ADMIN'), ctrl.applyLateFine);
router.put('/:ref/rejection-reason',      allowRoles('PSO','SW','CHAIRMAN','ADMIN'), ctrl.setRejectionReason);

module.exports = router;
