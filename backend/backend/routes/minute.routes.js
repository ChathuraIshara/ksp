const router  = require('express').Router();
const ctrl    = require('../controllers/minute.controller');
const auth    = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');
const { immutableGuard } = require('../middleware/immutableGuard');
const { Minute } = require('../models');

router.use(auth);

const OFFICERS = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

router.post('/',                              allowRoles(...OFFICERS), ctrl.createMinute);
router.get('/:id',                            ctrl.getById);
router.get('/ref/:ref',                       ctrl.getByRef);
router.get('/officer/:officerId',             allowRoles(...OFFICERS), ctrl.getByOfficer);
router.get('/ref/:ref/type/:type',            ctrl.getByType);
router.get('/ref/:ref/node/:officerType',     ctrl.getMinuteForNode);
router.put('/:id/draft',                      allowRoles(...OFFICERS), immutableGuard(Minute, 'id'), ctrl.saveDraft);
router.post('/:id/submit',                    allowRoles(...OFFICERS), immutableGuard(Minute, 'id'), ctrl.submitMinute);
router.post('/:id/attachments',               allowRoles(...OFFICERS), immutableGuard(Minute, 'id'), ctrl.attachDocuments);
router.put('/:id/attach',                      allowRoles(...OFFICERS), immutableGuard(Minute, 'id'), ctrl.attachDocuments);  // FE alias
router.put('/:id/forward',                    allowRoles('SW','PSO','CHAIRMAN','ADMIN'), immutableGuard(Minute, 'id'), ctrl.forwardMinute);
router.put('/:id/visibility',                 allowRoles('SW','CHAIRMAN','ADMIN'), immutableGuard(Minute, 'id'), ctrl.updateVisibility);
router.put('/:id/lock',                       allowRoles('SW','CHAIRMAN','ADMIN'), ctrl.lockMinute);

module.exports = router;
