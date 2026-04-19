const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  audit_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID },
  reference_number: { type: DataTypes.STRING(50) },
  action: { type: DataTypes.STRING(100), allowNull: false },
  entity_type: { type: DataTypes.STRING(100) },
  entity_id: { type: DataTypes.UUID },
  before_state: { type: DataTypes.JSON },
  after_state: { type: DataTypes.JSON },
  ip_address: { type: DataTypes.STRING(50) },
  user_agent: { type: DataTypes.TEXT },
  request_id: { type: DataTypes.STRING(36), comment: 'X-Request-ID for distributed tracing' },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'audit_logs' });

module.exports = AuditLog;
