const { Message } = require('../models');
const messageService = require('../services/message.service');
const { v4: uuidv4 } = require('uuid');
const { success, created, notFound, error, badRequest } = require('../utils/responseHelper');

const resolvePeerUserId = (msg, currentUserId) => (
  msg.sender_id === currentUserId ? msg.recipient_id : msg.sender_id
);

const summarizeConversations = (messages, currentUserId) => {
  const convMap = new Map();

  for (const m of messages) {
    const cid = m.conversation_id;
    const candidatePeer = resolvePeerUserId(m, currentUserId);
    const unreadForMe = !m.is_read && m.recipient_id === currentUserId;

    if (!convMap.has(cid)) {
      convMap.set(cid, {
        conversation_id: cid,
        reference_number: m.reference_number,
        peer_user_id: candidatePeer,
        last_message: m.content?.slice(0, 80),
        last_message_at: m.created_at,
        unread: unreadForMe ? 1 : 0,
        participants: [],
      });
      continue;
    }

    const conv = convMap.get(cid);
    if (unreadForMe) conv.unread += 1;
    if (!conv.peer_user_id && candidatePeer) conv.peer_user_id = candidatePeer;
  }

  return Array.from(convMap.values());
};

const TYPE_MAP = {
  'inspection-scheduling': 'TO_APPLICANT',
  'sw-clarification': 'SW_TO_CLARIFICATION',
  'rda-negotiation': 'RDA_AGREEMENT_NEGOTIATION',
  'cor-scheduling': 'COR_SCHEDULING',
};

const resolveContent = (body) => body.content || body.body || body.message || null;

const resolveConversationType = (body) => (
  body.conversation_type || TYPE_MAP[body.message_type] || 'TO_APPLICANT'
);

const inferRecipientFromHistory = (history, currentUserId) => {
  for (const h of history) {
    const candidate = resolvePeerUserId(h, currentUserId);
    if (candidate) return candidate;
  }
  return null;
};

const resolveThreadMeta = async ({ conversationId, referenceNumber, recipientId, currentUserId }) => {
  if (referenceNumber && recipientId) {
    return { reference_number: referenceNumber, resolvedRecipientId: recipientId };
  }
  if (!conversationId) {
    return { reference_number: referenceNumber, resolvedRecipientId: recipientId };
  }

  const history = await Message.findAll({
    where: { conversation_id: conversationId },
    order: [['created_at', 'DESC']],
    limit: 50,
    attributes: ['reference_number', 'sender_id', 'recipient_id'],
  });

  const resolvedReference = referenceNumber
    || history.find((h) => !!h.reference_number)?.reference_number
    || `CHAT-${String(conversationId).slice(0, 8)}`;

  const resolvedRecipientId = recipientId || inferRecipientFromHistory(history, currentUserId);
  return { reference_number: resolvedReference, resolvedRecipientId };
};

const emitRealtimeMessage = ({ req, msg, content }) => {
  setImmediate(() => {
    try {
      const io = require('../utils/socketServer').getIO();
      if (!io) return;
      const payload = {
        conversation_id: msg.conversation_id,
        message_id: msg.message_id,
        sender_id: req.user.user_id,
        body: content,
        created_at: msg.created_at,
      };

      if (msg.recipient_id) {
        io.to(`user:${msg.recipient_id}`).emit('message', payload);
        io.to(`user:${msg.recipient_id}`).emit('notification', {
          title: 'New Message',
          body: (content || '').slice(0, 100),
          event_type: 'MESSAGE_RECEIVED',
          reference_number: msg.reference_number || null,
          received_at: new Date().toISOString(),
        });
      }

      if (msg.conversation_id) {
        io.to(`conv:${msg.conversation_id}`).emit('message', payload);
      }
    } catch (e) {
      // Socket delivery is best-effort; don't fail HTTP request path.
      console.warn('Socket emit failed in sendMessage:', e?.message || e);
    }
  });
};

exports.initConversation = async (req, res, next) => {
  try {
    const conversationId = uuidv4();
    const recipient_id = req.body?.recipient_id || null;
    if (!recipient_id) {
      return badRequest(res, 'recipient_id is required to start a conversation');
    }
    const reference_number = `CHAT-${String(conversationId).slice(0, 8)}`;

    let participants = [];
    if (recipient_id) {
      const { User, Officer } = require('../models');
      const recipientUser = await User.findByPk(recipient_id, { attributes: ['user_id', 'role'] });
      if (recipientUser) {
        const recipientOfficer = await Officer.findOne({
          where: { user_id: recipient_id },
          attributes: ['full_name'],
        });
        participants = [{
          user_id: recipientUser.user_id,
          full_name: recipientOfficer?.full_name || recipientUser.role,
        }];
      }
    }

    return success(res, {
      conversation_id: conversationId,
      reference_number,
      peer_user_id: recipient_id,
      participants,
    });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const body = req.body;
    const content = resolveContent(body);
    if (!content) return badRequest(res, 'content is required');

    const conversation_type = resolveConversationType(body);
    const { reference_number, resolvedRecipientId } = await resolveThreadMeta({
      conversationId: body.conversation_id,
      referenceNumber: body.reference_number || null,
      recipientId: body.recipient_id || null,
      currentUserId: req.user.user_id,
    });

    if (!reference_number) {
      return badRequest(res, 'reference_number is required');
    }
    if (!resolvedRecipientId) {
      return badRequest(res, 'recipient_id is required for this conversation');
    }

    const msg = await Message.create({
      conversation_id:  body.conversation_id,
      reference_number,
      sender_id:        req.user.user_id,
      recipient_id:     resolvedRecipientId,
      conversation_type,
      content,
      attachments: body.attachments || null,
    });

    emitRealtimeMessage({ req, msg, content });

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

    const conversations = summarizeConversations(messages, req.user.user_id);
    return success(res, conversations);
  } catch (err) { next(err); }
};
