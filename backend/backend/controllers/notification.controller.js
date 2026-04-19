const { Notification } = require('../models');
const notifService = require('../services/notification.service');
const { sendEmail, sendSMS } = require('../utils/notificationDispatcher');
const { success, notFound, error } = require('../utils/responseHelper');

exports.getByUser = async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { recipient_id: req.user.user_id },
      order: [['created_at','DESC']],
      limit: 50,
    });
    return success(res, notifications);
  } catch (err) { next(err); }
};

exports.getUnread = async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { recipient_id: req.user.user_id, is_read: false },
      order: [['created_at','DESC']],
    });
    return success(res, notifications);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({ where: { reference_number: req.params.ref } });
    return success(res, notifications);
  } catch (err) { next(err); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await Notification.update({ is_read: true, read_at: new Date() }, { where: { notification_id: req.params.id, recipient_id: req.user.user_id } });
    return success(res, null, 'Marked as read');
  } catch (err) { next(err); }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.update({ is_read: true, read_at: new Date() }, { where: { recipient_id: req.user.user_id, is_read: false } });
    return success(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
};

exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    await Notification.update({ delivery_status: req.body.status }, { where: { notification_id: req.params.id } });
    return success(res, null, 'Delivery status updated');
  } catch (err) { next(err); }
};

exports.retryDelivery = async (req, res, next) => {
  try {
    const notif = await Notification.findByPk(req.params.id);
    if (!notif) return notFound(res);
    await notifService.dispatch({
      recipient_id: notif.recipient_id,
      event_type: notif.event_type,
      title: notif.title,
      body: notif.body,
      channel: notif.delivery_channel,
      reference_number: notif.reference_number,
      metadata: notif.metadata,
    });
    return success(res, null, 'Delivery retried');
  } catch (err) { next(err); }
};

exports.sendEmail = async (req, res, next) => {
  try {
    const { to, subject, body } = req.body;
    await sendEmail({ to, subject, text: body });
    return success(res, null, 'Email sent');
  } catch (err) { next(err); }
};

exports.sendSMS = async (req, res, next) => {
  try {
    const { to, message } = req.body;
    await sendSMS({ to, message });
    return success(res, null, 'SMS sent');
  } catch (err) { next(err); }
};

exports.sendInApp = async (req, res, next) => {
  try {
    const { recipient_id, title, body, reference_number } = req.body;
    await notifService.dispatch({ recipient_id, event_type: 'MANUAL', title, body, channel: 'IN_APP', reference_number });
    return success(res, null, 'In-app notification sent');
  } catch (err) { next(err); }
};

exports.broadcastToRoles = async (req, res, next) => {
  try {
    const { roles, title, body } = req.body;
    const { User } = require('../models');
    const users = await User.findAll({ where: { role: roles, status: 'ACTIVE' } });
    await Promise.all(users.map(u =>
      notifService.dispatch({ recipient_id: u.user_id, event_type: 'BROADCAST', title, body, channel: 'IN_APP' })
    ));
    return success(res, { sent_to: users.length }, 'Broadcast sent');
  } catch (err) { next(err); }
};

// GET /notifications/mine/unread-count — returns { count: N }
exports.getUnreadCount = async (req, res, next) => {
  try {
    const { Notification } = require('../models');
    const count = await Notification.count({
      where: { recipient_id: req.user.user_id, is_read: false },
    });
    return require('../utils/responseHelper').success(res, { count });
  } catch (err) { require('../utils/responseHelper').error(res, err.message); }
};
