const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  notification_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  recipient_id: { type: DataTypes.UUID, allowNull: false },
  reference_number: { type: DataTypes.STRING(50) },
  event_type: { type: DataTypes.STRING(100), allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  delivery_channel: { type: DataTypes.ENUM('IN_APP','EMAIL','SMS'), allowNull: false },
  delivery_status: { type: DataTypes.ENUM('PENDING','SENT','FAILED'), defaultValue: 'PENDING' },
  sent_at: { type: DataTypes.DATE },
  read_at: { type: DataTypes.DATE },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  metadata: { type: DataTypes.JSON },
}, { tableName: 'notifications',
  indexes: [
    { fields: ['recipient_id'] },
    { fields: ['is_read'] },
    { fields: ['created_at'] },
  ], });

module.exports = Notification;
