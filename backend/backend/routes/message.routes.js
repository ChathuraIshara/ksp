const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/message.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadHandler');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const ALL_AUTH = ['APPLICANT','PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];
const OFFICERS = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

router.post('/init',                               allowRoles(...OFFICERS), ctrl.initConversation);  // FE alias
router.post('/init-conversation',              allowRoles(...OFFICERS), ctrl.initConversation);
router.post('/conversations',                  allowRoles(...ALL_AUTH), ctrl.initConversation);   // FE alias: POST /messages/conversations
router.get('/conversations',                   allowRoles(...ALL_AUTH), ctrl.getMyConversations); // FE: list all conversations
router.post('/opening-template',               allowRoles(...OFFICERS), ctrl.generateSystemOpeningMessage);
router.post('/generate-template',              allowRoles(...OFFICERS), ctrl.generateSystemOpeningMessage);  // FE alias
router.post('/',                               allowRoles(...ALL_AUTH), validate(validate.schemas.sendMessage), ctrl.sendMessage);
router.get('/conversation/:conversationId',    ctrl.getConversationThread);
router.get('/ref/:ref/by-type/:type',          ctrl.getThreadByType);
router.get('/ref/:ref/type/:type',             ctrl.getThreadByType);   // FE alias
router.get('/ref/:ref',                        ctrl.getByRef);
router.get('/application/:applicationId',      allowRoles(...ALL_AUTH), ctrl.getByApplicationId);
router.put('/:id/read',                        ctrl.markAsRead);
router.post('/:id/reply',                      allowRoles(...ALL_AUTH), ctrl.replyToMessage);
router.post('/:id/attachments',                upload.array('files', 5), ctrl.attachFiles);
// Unread count — a user can only see their own (controller uses req.user.user_id)
router.get('/unread-count/:userId',            ctrl.getUnreadCount);

module.exports = router;
