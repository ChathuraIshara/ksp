const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeeConfiguration = sequelize.define('FeeConfiguration', {
  fee_config_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  plan_type_id: { type: DataTypes.UUID },
  fee_type: {
    type: DataTypes.ENUM('APPLICATION','APPROVAL','EXTENSION','COR','APPEAL','FINE','LATE_COR'),
    allowNull: false,
  },
  rate_per_sqft: { type: DataTypes.DECIMAL(10,4) },
  rate_per_perch: { type: DataTypes.DECIMAL(10,4) },
  rate_per_lm: { type: DataTypes.DECIMAL(10,4) },
  flat_fee: { type: DataTypes.DECIMAL(12,2) },
  penalty_rate_per_sqft: { type: DataTypes.DECIMAL(10,4) },
  min_fee: { type: DataTypes.DECIMAL(12,2) },
  max_fee: { type: DataTypes.DECIMAL(12,2) },
  effective_from: { type: DataTypes.DATE, allowNull: false },
  effective_to: { type: DataTypes.DATE },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'fee_configurations' });

module.exports = FeeConfiguration;
