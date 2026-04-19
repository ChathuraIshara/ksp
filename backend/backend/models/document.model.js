const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Document = sequelize.define('Document', {
  document_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID },
  uploaded_by: { type: DataTypes.UUID, allowNull: false },
  category: { type: DataTypes.STRING(100), allowNull: false },
  original_filename: { type: DataTypes.STRING(255), allowNull: false },
  stored_filename: { type: DataTypes.STRING(255), allowNull: false },
  file_path: { type: DataTypes.STRING(500), allowNull: false },
  file_type: { type: DataTypes.STRING(20) },
  file_size_kb: { type: DataTypes.INTEGER },
  version_number: { type: DataTypes.INTEGER, defaultValue: 1 },
  superseded_by: { type: DataTypes.UUID },
  is_current: { type: DataTypes.BOOLEAN, defaultValue: true },
  verification_status: { type: DataTypes.ENUM('PENDING','VERIFIED','REJECTED'), defaultValue: 'PENDING' },
  rejection_reason: { type: DataTypes.TEXT },
  verified_by: { type: DataTypes.UUID },
  verified_at: { type: DataTypes.DATE },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'documents' });

module.exports = Document;
