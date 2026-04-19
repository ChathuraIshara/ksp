const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PCAttendee = sequelize.define('PCAttendee', {
  attendee_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  meeting_id: { type: DataTypes.UUID, allowNull: false },
  officer_id: { type: DataTypes.UUID, allowNull: false },
  role_in_meeting: { type: DataTypes.STRING(100) },
  attendance_status: { type: DataTypes.ENUM('INVITED','CONFIRMED','ATTENDED','ABSENT'), defaultValue: 'INVITED' },
  confirmed_at: { type: DataTypes.DATE },
  meeting_notes: { type: DataTypes.TEXT },
}, { tableName: 'pc_attendees' });

module.exports = PCAttendee;
