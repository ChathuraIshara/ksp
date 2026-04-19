const router  = require('express').Router();
const ctrl    = require('../controllers/corCertificate.controller');
const auth    = require('../middleware/auth');
const { allowRoles }     = require('../middleware/roleGuard');
const trackingViewGuard  = require('../middleware/trackingViewGuard');
const { immutableGuard } = require('../middleware/immutableGuard');
const { CORCertificate } = require('../models');

router.use(auth);

router.get('/',                     allowRoles('CHAIRMAN','PSO','SW','ADMIN'), ctrl.listAll);
router.post('/',                    ctrl.generateCORCertificate);  // FE alias: POST /
router.post('/generate',            ctrl.generateCORCertificate);
router.get('/ref/:ref',             ctrl.getByRef);
router.get('/ref/:ref/view-only',   trackingViewGuard, ctrl.getCORViewOnly);
router.get('/code/:code',           ctrl.getByCode);
router.get('/:id/verify',           ctrl.verifyCORCertificate);
router.get('/:id/qr',               ctrl.generateQRCode);
router.put('/:id/sign',             allowRoles('CHAIRMAN','PSO'), immutableGuard(CORCertificate, 'id'), ctrl.applyDigitalSignature);
router.put('/:id/seal',             allowRoles('PSO','ADMIN'),    immutableGuard(CORCertificate, 'id'), ctrl.recordManualSeal);
router.post('/:id/issue',           allowRoles('PSO','ADMIN'),    immutableGuard(CORCertificate, 'id'), ctrl.issueCORCertificate);
router.post('/:id/print',           allowRoles('PSO','CHAIRMAN','ADMIN'), ctrl.printCORCertificate);
router.post('/:id/print',           allowRoles('PSO'),            ctrl.printCORCertificate);
router.put('/:id/lock',             allowRoles('CHAIRMAN','ADMIN'), ctrl.lockCORCertificate);

module.exports = router;
