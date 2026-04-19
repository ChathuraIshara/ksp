const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Applicant = sequelize.define('Applicant', {
  applicant_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  full_name: { type: DataTypes.STRING(255), allowNull: false },
  nic_number: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  phone: { type: DataTypes.STRING(20) },
  address: { type: DataTypes.TEXT },
  profile_photo_path: { type: DataTypes.STRING(500) },
}, { tableName: 'applicants' });

module.exports = Applicant;
