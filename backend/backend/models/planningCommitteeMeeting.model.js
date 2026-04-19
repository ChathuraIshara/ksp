const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlanningCommitteeMeeting = sequelize.define('PlanningCommitteeMeeting', {
  meeting_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  meeting_number: { type: DataTypes.STRING(50), unique: true },
  meeting_date: { type: DataTypes.DATE, allowNull: false },
  venue: { type: DataTypes.STRING(255) },
  agenda: { type: DataTypes.JSON },
  status: { type: DataTypes.ENUM('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'), defaultValue: 'SCHEDULED' },
  chaired_by: { type: DataTypes.UUID },
  minutes_path: { type: DataTypes.STRING(500) },
  completed_at: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'planning_committee_meetings' });

module.exports = PlanningCommitteeMeeting;
