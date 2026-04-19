const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Agreement = sequelize.define('Agreement', {
  agreement_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  external_approval_id: { type: DataTypes.UUID, allowNull: false },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  agreement_type: { type: DataTypes.ENUM('RDA_WAIVER','BOUNDARY_AGREEMENT'), defaultValue: 'RDA_WAIVER' },
  document_path: { type: DataTypes.STRING(500) },
  signed_by_applicant: { type: DataTypes.BOOLEAN, defaultValue: false },
  applicant_signed_at: { type: DataTypes.DATE },
  signed_by_officer: { type: DataTypes.BOOLEAN, defaultValue: false },
  officer_signed_at: { type: DataTypes.DATE },
  officer_id: { type: DataTypes.UUID },
  conversation_id: { type: DataTypes.UUID },
  negotiation_complete: { type: DataTypes.BOOLEAN, defaultValue: false },
  notified_applicant_at: { type: DataTypes.DATE },
}, { tableName: 'agreements' });

module.exports = Agreement;
