const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TrackingLine = sequelize.define('TrackingLine', {
  tracking_line_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  application_id: { type: DataTypes.UUID, allowNull: false },
  current_node_id: { type: DataTypes.UUID },
  overall_status: { type: DataTypes.STRING(100) },
}, { tableName: 'tracking_lines',
  indexes: [
    { fields: ['reference_number'] },
  ], });

module.exports = TrackingLine;
