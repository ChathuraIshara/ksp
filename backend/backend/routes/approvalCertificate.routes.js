const router  = require('express').Router();
const ctrl    = require('../controllers/approvalCertificate.controller');
const auth    = require('../middleware/auth');
const { allowRoles }     = require('../middleware/roleGuard');
const trackingViewGuard  = require('../middleware/trackingViewGuard');
const { immutableGuard } = require('../middleware/immutableGuard');
const { ApprovalCertificate } = require('../models');

router.use(auth);

router.post('/',                    ctrl.generateCertificate);  // FE alias: POST /
router.post('/generate',            ctrl.generateCertificate);
// Batch sign: Chairman signs many certs with one OTP
router.post('/batch-sign',          allowRoles('CHAIRMAN'), ctrl.batchSign);
router.get('/',               allowRoles('CHAIRMAN','PSO','SW','ADMIN'), ctrl.listAll);
router.get('/ref/:ref',             ctrl.getByRef);
router.get('/ref/:ref/view-only',   trackingViewGuard, ctrl.getCertificateViewOnly);
// Payment-gated download — applicant/PSO/Chairman can call after APPROVAL_FEE is PAID
router.get('/ref/:ref/download',    ctrl.downloadCertificate);
router.get('/code/:code',           ctrl.getByCode);
router.get('/:id/verify',           ctrl.verifyCertificate);
router.get('/:id/qr',               ctrl.generateQRCode);
// Mutation routes — blocked if certificate is_immutable
router.put('/:id/sign',             allowRoles('CHAIRMAN'),         immutableGuard(ApprovalCertificate, 'id'), ctrl.applyDigitalSignature);
router.put('/:id/seal',             allowRoles('PSO','ADMIN'),      immutableGuard(ApprovalCertificate, 'id'), ctrl.recordManualSeal);
router.post('/:id/issue',           allowRoles('PSO','ADMIN'),      immutableGuard(ApprovalCertificate, 'id'), ctrl.issueCertificate);
router.post('/:id/print',           allowRoles('PSO'),              ctrl.printCertificate);   // print always allowed (logged)
router.put('/:id/lock',             allowRoles('CHAIRMAN','ADMIN'), ctrl.lockCertificate);    // lock sets is_immutable — always allowed

module.exports = router;
