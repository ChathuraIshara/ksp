const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaxOwnerChangeHistory = sequelize.define('TaxOwnerChangeHistory', {
  history_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tax_record_id: { type: DataTypes.UUID, allowNull: false },
  owner_id: { type: DataTypes.UUID },
  application_ref: { type: DataTypes.STRING(50) },
  old_owner_name: { type: DataTypes.STRING(255) },
  new_owner_name: { type: DataTypes.STRING(255) },
  change_type: { type: DataTypes.ENUM('NAME_CHANGE','OWNERSHIP_TRANSFER','NEW_OWNER','OWNER_REMOVED') },
  change_reason: { type: DataTypes.TEXT },
  proof_document_path: { type: DataTypes.STRING(500) },
  changed_by: { type: DataTypes.UUID, allowNull: false },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'tax_owner_change_history' });

module.exports = TaxOwnerChangeHistory;
