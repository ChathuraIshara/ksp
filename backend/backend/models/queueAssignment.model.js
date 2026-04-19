const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QueueAssignment = sequelize.define('QueueAssignment', {
  assignment_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  queue_id: { type: DataTypes.UUID, allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  reference_number: { type: DataTypes.STRING(50) },
  assigned_by: { type: DataTypes.UUID },
  status: { type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'SUPERSEDED'), defaultValue: 'PENDING' },
  issue_note: { type: DataTypes.TEXT },
  resolution_note: { type: DataTypes.TEXT },
  resolved_by: { type: DataTypes.UUID },
  resolved_at: { type: DataTypes.DATE },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'queue_assignments' });

module.exports = QueueAssignment;
