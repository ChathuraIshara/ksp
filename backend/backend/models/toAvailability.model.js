const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * TOAvailability — stores TO working hours and blocked dates.
 * Used before scheduling inspections to check if the TO is free.
 */
const TOAvailability = sequelize.define('TOAvailability', {
  availability_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  officer_id:      { type: DataTypes.UUID, allowNull: false, comment: 'FK → users.user_id (TO role)' },
  date:            { type: DataTypes.DATEONLY, allowNull: false, comment: 'Calendar date' },
  is_available:    { type: DataTypes.BOOLEAN, defaultValue: true },
  start_time:      { type: DataTypes.STRING(10), defaultValue: '08:00', comment: 'Available from HH:MM' },
  end_time:        { type: DataTypes.STRING(10), defaultValue: '17:00', comment: 'Available until HH:MM' },
  slots_remaining: { type: DataTypes.INTEGER, defaultValue: 3, comment: 'Max inspections per day' },
  block_reason:    { type: DataTypes.STRING(255), comment: 'Why blocked: LEAVE, HOLIDAY, FULL, etc.' },
}, { tableName: 'to_availability' });

module.exports = TOAvailability;
