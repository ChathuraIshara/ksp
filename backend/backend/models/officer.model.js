const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Officer = sequelize.define('Officer', {
  officer_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  full_name: { type: DataTypes.STRING(255), allowNull: false },
  nic_number: { type: DataTypes.STRING(20), unique: true },
  designation: { type: DataTypes.STRING(255) },
  department: { type: DataTypes.STRING(255) },
  phone: { type: DataTypes.STRING(20) },
  employee_id: { type: DataTypes.STRING(50) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  verified_by: { type: DataTypes.UUID },
  verified_at: { type: DataTypes.DATE },
  rejection_reason: { type: DataTypes.TEXT },
  digital_signature_path: { type: DataTypes.STRING(500) },
}, { tableName: 'officers' });

module.exports = Officer;
