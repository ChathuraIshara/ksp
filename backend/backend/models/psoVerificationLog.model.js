const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PSOVerificationLog = sequelize.define('PSOVerificationLog', {
  log_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  pso_id: { type: DataTypes.UUID, allowNull: false },
  tax_number_checked: { type: DataTypes.STRING(50) },
  name_match_result: { type: DataTypes.ENUM('MATCHED','MISMATCH','PENDING'), defaultValue: 'PENDING' },
  doc_completeness_result: { type: DataTypes.ENUM('COMPLETE','INCOMPLETE','PENDING'), defaultValue: 'PENDING' },
  complaint_flag: { type: DataTypes.BOOLEAN, defaultValue: false },
  action_taken: { type: DataTypes.ENUM('VERIFIED','DOCUMENT_ISSUE','NAME_MISMATCH','COMPLAINT','RESUBMISSION') },
  verification_note: { type: DataTypes.TEXT },
  queue_assigned: { type: DataTypes.STRING(50) },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'pso_verification_logs',
  indexes: [
    { fields: ['reference_number'] },
  ], });

module.exports = PSOVerificationLog;
