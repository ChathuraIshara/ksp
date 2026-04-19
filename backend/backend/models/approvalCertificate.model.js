const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ApprovalCertificate = sequelize.define('ApprovalCertificate', {
  certificate_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  decision_id: { type: DataTypes.UUID, allowNull: false },
  certificate_number: { type: DataTypes.STRING(50), unique: true },
  verification_code: { type: DataTypes.STRING(100), unique: true },
  qr_code_path: { type: DataTypes.STRING(500) },
  pdf_path: { type: DataTypes.STRING(500) },
  conditions: { type: DataTypes.TEXT },
  approval_date: { type: DataTypes.DATE },
  expiry_date: { type: DataTypes.DATE },
  digital_signature: { type: DataTypes.TEXT },
  signed_by: { type: DataTypes.UUID },
  signed_at: { type: DataTypes.DATE },
  manual_seal_applied: { type: DataTypes.BOOLEAN, defaultValue: false },
  seal_applied_by: { type: DataTypes.UUID },
  seal_applied_at: { type: DataTypes.DATE },
  is_issued: { type: DataTypes.BOOLEAN, defaultValue: false },
  issued_at: { type: DataTypes.DATE },
  issued_by: { type: DataTypes.UUID },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'approval_certificates' });

module.exports = ApprovalCertificate;
