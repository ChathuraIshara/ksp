const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PCApplication = sequelize.define('PCApplication', {
  pc_application_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  meeting_id: { type: DataTypes.UUID, allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  presentation_order: { type: DataTypes.INTEGER },
  carried_from_meeting_id: { type: DataTypes.UUID },
  is_carried_over: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('PENDING','PRESENTED','DECIDED','DEFERRED','CARRIED_OVER'), defaultValue: 'PENDING' },
  added_by: { type: DataTypes.UUID },
  uda_minute_id: { type: DataTypes.UUID },
  member_minutes: { type: DataTypes.JSON, defaultValue: [], comment: 'Array of {minute_id, authored_by, role, added_at} for per-member PC minutes' },
}, { tableName: 'pc_applications' });

module.exports = PCApplication;
