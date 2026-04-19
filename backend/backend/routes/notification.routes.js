const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/notification.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);

const OFFICERS = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

// Users read/manage their own notifications (controller scopes by req.user.user_id)
router.get('/',                              ctrl.getByUser);
router.get('/mine',                          ctrl.getByUser);         // alias used by frontend
router.get('/unread',                        ctrl.getUnread);
router.get('/unread-count',                  ctrl.getUnreadCount);    // FE calls /notifications/unread-count
router.get('/mine/unread-count',             ctrl.getUnreadCount);    // alias used by frontend
router.get('/ref/:ref',                      ctrl.getByRef);
router.put('/:id/read',                      ctrl.markAsRead);
router.put('/read-all',                      ctrl.markAllAsRead);
router.put('/mark-all-read',                 ctrl.markAllAsRead);   // FE alias
router.put('/:id/delivery-status',           allowRoles(...OFFICERS), ctrl.updateDeliveryStatus);
router.post('/:id/retry',                    allowRoles(...OFFICERS), ctrl.retryDelivery);

// Sending notifications — officer/admin only
router.post('/send-email',                   allowRoles(...OFFICERS), ctrl.sendEmail);
router.post('/send-sms',                     allowRoles(...OFFICERS), ctrl.sendSMS);
router.post('/send-in-app',                  allowRoles(...OFFICERS), ctrl.sendInApp);
router.post('/broadcast',                    allowRoles('CHAIRMAN','ADMIN'), validate(validate.schemas.broadcastNotification), ctrl.broadcastToRoles);

module.exports = router;
