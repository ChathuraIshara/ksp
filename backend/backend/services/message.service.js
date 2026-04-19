const { v4: uuidv4 } = require('uuid');
const { Message } = require('../models');

const generateOpeningTemplate = async ({ referenceNumber, toName, applicantName, planType, scheduledDate, scheduledTime, propertyAddress }) => {
  const conversationId = uuidv4();

  if (!scheduledDate || !scheduledTime) {
    throw new Error('scheduled_date and scheduled_time are required to generate the inspection invitation template');
  }

  const formattedDate = new Date(scheduledDate).toLocaleDateString('en-LK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const content =
    `Dear ${applicantName},

` +
    `I am ${toName}, the Technical Officer assigned to inspect your ${planType || 'planning'} application ` +
    `(Ref: ${referenceNumber}) on behalf of the Kelaniya Pradeshiya Sabha.

` +
    `I would like to schedule a site inspection at your property:

` +
    `📅 Date:     ${formattedDate}
` +
    `🕐 Time:     ${scheduledTime}
` +
    `📍 Address:  ${propertyAddress || 'As per your application'}

` +
    `Please ensure that:
` +
    `  • The property is accessible at the scheduled time
` +
    `  • A responsible adult is present during the inspection
` +
    `  • Any work-in-progress areas are accessible for assessment

` +
    `If you are unable to accommodate this time, please reply to this message with your ` +
    `preferred alternative date and time at least 24 hours before the scheduled inspection.

` +
    `Once you confirm, we will finalise the schedule. Failure to respond within 48 hours ` +
    `will be treated as acceptance of the proposed time.

` +
    `Regards,
${toName}
Technical Officer — Kelaniya Pradeshiya Sabha`;

  const message = await Message.create({
    message_id: uuidv4(),
    conversation_id: conversationId,
    reference_number: referenceNumber,
    sender_id: null, // system-generated, set by controller
    conversation_type: 'TO_APPLICANT',
    content,
    is_system_message: true,
    metadata: JSON.stringify({ scheduled_date: scheduledDate, scheduled_time: scheduledTime }),
  });

  return { conversationId, message };
};

const getThread = async (conversationId) => {
  return Message.findAll({
    where: { conversation_id: conversationId },
    order: [['created_at', 'ASC']],
  });
};

const getThreadByType = async (referenceNumber, type) => {
  return Message.findAll({
    where: { reference_number: referenceNumber, conversation_type: type },
    order: [['created_at', 'ASC']],
  });
};

module.exports = { generateOpeningTemplate, getThread, getThreadByType };
