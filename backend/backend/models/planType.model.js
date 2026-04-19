const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlanType = sequelize.define('PlanType', {
  plan_type_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  category: { type: DataTypes.ENUM('BUILDING_PLAN','PLOT_OF_LAND','BOUNDARY_WALL'), allowNull: false },
  subtype: { type: DataTypes.STRING(100) },
  display_name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  required_documents: { type: DataTypes.JSON },
  requires_ho_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
  requires_rda_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
  requires_gjs_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
  base_fee: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'plan_types' });

module.exports = PlanType;
