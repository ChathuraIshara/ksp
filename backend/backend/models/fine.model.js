const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Fine = sequelize.define('Fine', {
  fine_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  fine_type: { type: DataTypes.ENUM('UNAUTHORIZED_CONSTRUCTION','LATE_COR'), allowNull: false },
  calculated_by: { type: DataTypes.UUID },
  unauthorized_sqft: { type: DataTypes.DECIMAL(10,2) },
  rate_applied: { type: DataTypes.DECIMAL(10,4) },
  fine_amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  payment_status: { type: DataTypes.ENUM('PENDING','PAID','WAIVED'), defaultValue: 'PENDING' },
  payment_id: { type: DataTypes.UUID },
  waived_by: { type: DataTypes.UUID },
  waive_reason: { type: DataTypes.TEXT },
  notified_at: { type: DataTypes.DATE },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'fines' });

module.exports = Fine;
