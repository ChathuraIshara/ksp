const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Queue = sequelize.define('Queue', {
  queue_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  queue_type: {
    type: DataTypes.ENUM('DOCUMENT_ISSUE','NAME_MISMATCH','COMPLAINT','VERIFIED','RESUBMISSION','ONLINE_ONLY','WALK_IN'),
    allowNull: false,
  },
  submission_mode: { type: DataTypes.ENUM('ONLINE','MANUAL','ALL'), defaultValue: 'ALL' },
  display_name: { type: DataTypes.STRING(100) },
  colour_code: { type: DataTypes.STRING(20) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'queues' });

module.exports = Queue;