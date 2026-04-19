const { Message } = require('../models');
const messageService = require('../services/message.service');
const { v4: uuidv4 } = require('uuid');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.initConversation = async (req, res, next) => {
  try {
    const conversationId = uuidv4();
    return success(res, { conversation_id: conversationId });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const body = req.body;
    // Field name compatibility: some components send 'body'/'message_type' instead of 'content'/'conversation_type'
    const content = body.content || body.body || body.message || null;
    if (!content) return badRequest(res, 'content is required');

    // Map message_type aliases → conversation_type ENUM
    const TYPE_MAP = {
      'inspection-scheduling': 'TO_APPLICANT',
      'sw-clarification':      'SW_TO_CLARIFICATION',
      'rda-negotiation':       'RDA_AGREEMENT_NEGOTIATION',
      'cor-scheduling':        'COR_SCHEDULING',
    };
    const conversation_type = body.conversation_type
      || TYPE_MAP[body.message_type]
      || 'TO_APPLICANT';  // safe fallback for scheduling messages

    const msg = await Message.create({
      conversation_id:  body.conversation_id,
      reference_number: body.reference_number,
      sender_id:        req.user.user_id,
      recipient_id:     body.recipient_id || null,
      conversation_type,
      content,
      attachments: body.attachments || null,
    });

    // FR-07: Real-time message delivery via Socket.io
    setImmediate(() => {
      try {
        const io = require('../utils/socketServer').getIO();
        if (!io) return;
        const payload = {
          conversation_id: msg.conversation_id,
          message_id:      msg.message_id,
          sender_id:       req.user.user_id,
          body:            content,
          created_at:      msg.created_at,
        };
        // Notify recipient room
        if (msg.recipient_id) {
          io.to(`user:${msg.recipient_id}`).emit('message', payload);
          io.to(`user:${msg.recipient_id}`).emit('notification', {
            title:            'New Message',
            body:             (content || '').slice(0, 100),
            event_type:       'MESSAGE_RECEIVED',
            reference_number: msg.reference_number || null,
            received_at:      new Date().toISOString(),
          });
        }
        // Also update conversation list for conversation-scoped rooms
        if (msg.conversation_id) {
          io.to(`conv:${msg.conversation_id}`).emit('message', payload);
        }
      } catch (e) { /* socket is best-effort */ }
    });

    return created(res, msg);
  } catch (err) { next(err); }
};

exports.getConversationThread = async (req, res, next) => {
  try {
    const messages = await messageService.getThread(req.params.conversationId);
    return success(res, messages);
  } catch (err) { next(err); }
};

exports.getThreadByType = async (req, res, next) => {
  try {
    const messages = await messageService.getThreadByType(req.params.ref, req.params.type);
    return success(res, messages);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const messages = await Message.findAll({
      where: { reference_number: req.params.ref },
      order: [['created_at', 'ASC']],
    });
    return success(res, messages);
  } catch (err) { next(err); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await Message.update({ is_read: true, read_at: new Date() }, { where: { message_id: req.params.id } });
    return success(res, null, 'Marked as read');
  } catch (err) { next(err); }
};

exports.replyToMessage = async (req, res, next) => {
  try {
    const original = await Message.findByPk(req.params.id);
    if (!original) return notFound(res);
    const reply = await Message.create({
      conversation_id: original.conversation_id,
      reference_number: original.reference_number,
      sender_id: req.user.user_id,
      recipient_id: original.sender_id,
      conversation_type: original.conversation_type,
      content: req.body.content,
    });
    return created(res, reply);
  } catch (err) { next(err); }
};

exports.attachFiles = async (req, res, next) => {
  try {
    if (!req.files?.length) return error(res, 'No files uploaded', 400);
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return notFound(res);
    const attachments = [...(msg.attachments || []), ...req.files.map(f => f.path)];
    await msg.update({ attachments });
    return success(res, { attachments });
  } catch (err) { next(err); }
};

exports.generateSystemOpeningMessage = async (req, res, next) => {
  // Auto-generates the full inspection invitation message body.
  // TO only needs to supply scheduled_date and scheduled_time.
  // The rest is populated by the system from the application record.
  try {
    const { reference_number, to_name, applicant_name, plan_type, scheduled_date } = req.body;
    const result = await messageService.generateOpeningTemplate({
      referenceNumber: reference_number,
      toName: to_name,
      applicantName: applicant_name,
      planType: plan_type,
      scheduledDate: scheduled_date,
    });
    // Patch sender_id after creation
    if (result.message) {
      await Message.update({ sender_id: req.user.user_id }, { where: { message_id: result.message.message_id } });
    }
    return created(res, result);
  } catch (err) { next(err); }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Message.count({ where: { recipient_id: req.params.userId, is_read: false } });
    return success(res, { unread_count: count });
  } catch (err) { next(err); }
};

exports.getByApplicationId = async (req, res, next) => {
  try {
    // Message model has no application_id column — look up ref via Application first
    const { Application } = require('../models');
    const app = await Application.findByPk(req.params.applicationId, { attributes: ['reference_number'] });
    if (!app) return notFound(res, 'Application not found');
    const messages = await Message.findAll({
      where: { reference_number: app.reference_number },
      order: [['created_at', 'ASC']],
    });
    return success(res, messages);
  } catch (err) { next(err); }
};

/**
 * GET /messages/conversations — get all conversation threads for the current user
 * Returns unique conversation IDs with last message summary
 */
exports.getMyConversations = async (req, res, next) => {
  try {
    const { Message } = require('../models');
    const { Op } = require('sequelize');
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: req.user.user_id },
          { recipient_id: req.user.user_id },
        ],
        conversation_id: { [Op.ne]: null },
      },
      order: [['created_at', 'DESC']],
      limit: 200,
    });

    // Group by conversation_id
    const convMap = new Map();
    for (const m of messages) {
      const cid = m.conversation_id;
      if (!convMap.has(cid)) {
        convMap.set(cid, {
          conversation_id: cid,
          reference_number: m.reference_number,
          last_message: m.content?.slice(0, 80),
          last_message_at: m.created_at,
          unread: !m.is_read && m.recipient_id === req.user.user_id ? 1 : 0,
          participants: [],
        });
      } else if (!m.is_read && m.recipient_id === req.user.user_id) {
        convMap.get(cid).unread += 1;
      }
    }

    return require('../utils/responseHelper').success(res, Array.from(convMap.values()));
  } catch (err) { next(err); }
};
