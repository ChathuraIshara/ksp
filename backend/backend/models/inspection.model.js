const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inspection = sequelize.define('Inspection', {
  inspection_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  task_id: { type: DataTypes.UUID },
  officer_id: { type: DataTypes.UUID, allowNull: false },
  conversation_id: { type: DataTypes.UUID },
  inspection_type: { type: DataTypes.ENUM('INITIAL','SUPPLEMENTARY','COR_FINAL','COMPLAINT'), defaultValue: 'INITIAL' },
  priority_level: { type: DataTypes.ENUM('NORMAL','HIGH','URGENT'), defaultValue: 'NORMAL' },
  status: { type: DataTypes.ENUM('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','RESCHEDULED'), defaultValue: 'SCHEDULED' },
  scheduled_date: { type: DataTypes.DATE },
  actual_date: { type: DataTypes.DATE },
  location_address: { type: DataTypes.TEXT },
  cancellation_reason: { type: DataTypes.TEXT },
  drafted_offline: { type: DataTypes.BOOLEAN, defaultValue: false },
  offline_draft_data: { type: DataTypes.JSON },
  synced_at: { type: DataTypes.DATE },
}, { tableName: 'inspections',
  indexes: [
    { fields: ['reference_number'] },
    { fields: ['officer_id'] },
    { fields: ['application_id'] },
  ], });

module.exports = Inspection;
