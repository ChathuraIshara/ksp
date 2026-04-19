const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaskAssignment = sequelize.define('TaskAssignment', {
  task_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  assigned_to: { type: DataTypes.UUID, allowNull: false },
  assigned_by: { type: DataTypes.UUID, allowNull: false },
  task_type: { type: DataTypes.ENUM('SW_REVIEW','TO_INSPECTION','SUPPLEMENTARY_INSPECTION','COR_INSPECTION','APPEAL_INSPECTION','COMPLAINT_INSPECTION'), allowNull: false },
  status: { type: DataTypes.ENUM('PENDING','IN_PROGRESS','COMPLETED','REASSIGNED'), defaultValue: 'PENDING' },
  assignment_note: { type: DataTypes.TEXT },
  to_workload_snapshot: { type: DataTypes.JSON },
  due_date: { type: DataTypes.DATE },
  completed_at: { type: DataTypes.DATE },
  stage_at_assignment: { type: DataTypes.STRING(100) },
}, { tableName: 'task_assignments',
  indexes: [
    { fields: ['assigned_to'] },
    { fields: ['application_id'] },
    { fields: ['status'] },
  ], });

module.exports = TaskAssignment;
