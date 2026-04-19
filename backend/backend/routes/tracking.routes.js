const router = require('express').Router();
const ctrl = require('../controllers/tracking.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');
const trackingViewGuard = require('../middleware/trackingViewGuard');

// UC39 — Public unauthenticated tracking (applicant-visible nodes only, no officer data)
// Must be declared BEFORE router.use(auth) so it is accessible without a token
router.get('/public/:ref', ctrl.getPublicTracking);
router.get('/public/tax/:taxNumber', ctrl.getPublicTrackingByTax);  // track by assessment tax number

router.use(auth);

const OFFICERS = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

// Both applicants and officers can view their own tracking
router.get('/ref/:ref',                            ctrl.getByRef);  // FE calls /tracking/ref/:ref
router.get('/:ref',                                ctrl.getByRef);
router.get('/:ref/history',                        ctrl.getTrackingHistory);
router.get('/:ref/nodes/:nodeId',                  trackingViewGuard, ctrl.getNodeById);
router.get('/:ref/applicant-view',                 trackingViewGuard, ctrl.displayForApplicant);
router.get('/ref/:ref/applicant-view',             trackingViewGuard, ctrl.displayForApplicant);  // FE alias
router.get('/ref/:ref/applicant',                  trackingViewGuard, ctrl.displayForApplicant);  // FE alias: /applicant
router.get('/ref/:ref/officer',                    ctrl.getByRef);           // FE: officer view = full tracking

// Officer-only views and mutations
router.get('/:ref/officer-view',                   allowRoles(...OFFICERS), ctrl.displayForOfficer);
router.put('/:ref/current-node',                   allowRoles(...OFFICERS), ctrl.updateCurrentNode);
router.post('/:ref/nodes/further-review',          allowRoles('SW','CHAIRMAN','ADMIN'), ctrl.createFurtherReviewNode);
router.get('/:ref/nodes/type/:nodeType',           allowRoles(...OFFICERS), ctrl.getNodesByType);
router.get('/:ref/nodes/appeal',                   allowRoles(...OFFICERS), ctrl.getAppealNodes);
// PDF: officers control whether applicant can see node content
router.put('/:ref/nodes/:nodeId/visibility',       allowRoles(...OFFICERS), ctrl.setNodeVisibility);

module.exports = router;
