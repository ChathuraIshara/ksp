const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  message_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  conversation_id: { type: DataTypes.UUID, allowNull: false },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  sender_id: { type: DataTypes.UUID, allowNull: false },
  recipient_id: { type: DataTypes.UUID },
  conversation_type: {
    type: DataTypes.ENUM('TO_APPLICANT','SW_TO_CLARIFICATION','RDA_AGREEMENT_NEGOTIATION','COR_SCHEDULING'),
    allowNull: false,
  },
  content: { type: DataTypes.TEXT, allowNull: false },
  attachments: { type: DataTypes.JSON },
  is_system_message: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  read_at: { type: DataTypes.DATE },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'messages' });

module.exports = Message;
