const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CORCertificate = sequelize.define('CORCertificate', {
  cor_certificate_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  cor_application_id: { type: DataTypes.UUID, allowNull: false },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  final_inspection_id: { type: DataTypes.UUID },
  cor_number: { type: DataTypes.STRING(50), unique: true },
  verification_code: { type: DataTypes.STRING(100), unique: true },
  qr_code_path: { type: DataTypes.STRING(500) },
  pdf_path: { type: DataTypes.STRING(500) },
  compliance_notes: { type: DataTypes.TEXT },
  digital_signature: { type: DataTypes.TEXT },
  signed_by: { type: DataTypes.UUID },
  signed_at: { type: DataTypes.DATE },
  manual_seal_applied: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_issued: { type: DataTypes.BOOLEAN, defaultValue: false },
  issued_at: { type: DataTypes.DATE },
  issued_by: { type: DataTypes.UUID },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'cor_certificates' });

module.exports = CORCertificate;
