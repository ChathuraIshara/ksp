const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaxRecordOwner = sequelize.define('TaxRecordOwner', {
  owner_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tax_record_id: { type: DataTypes.UUID, allowNull: false },
  owner_name: { type: DataTypes.STRING(255), allowNull: false },
  nic_number: { type: DataTypes.STRING(20) },
  ownership_percentage: { type: DataTypes.DECIMAL(5,2), defaultValue: 100.00 },
  is_primary: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  contact_phone: { type: DataTypes.STRING(20) },
  contact_email: { type: DataTypes.STRING(255) },
  effective_from: { type: DataTypes.DATE },
  effective_to: { type: DataTypes.DATE },
}, { tableName: 'tax_record_owners' });

module.exports = TaxRecordOwner;
