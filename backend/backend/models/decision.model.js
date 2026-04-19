const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Decision = sequelize.define('Decision', {
  decision_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  meeting_id: { type: DataTypes.UUID, allowNull: false },
  decision_type: { type: DataTypes.ENUM('APPROVED','CONDITIONALLY_APPROVED','REJECTED','FURTHER_REVIEW','DEFERRED'), allowNull: false },
  conditions: { type: DataTypes.TEXT },
  rejection_reason: { type: DataTypes.TEXT },
  further_review_requirements: { type: DataTypes.TEXT },
  deferred_to_meeting_id: { type: DataTypes.UUID },
  votes: { type: DataTypes.JSON },
  uda_minute_id: { type: DataTypes.UUID },
  approval_fee_amount: { type: DataTypes.DECIMAL(12,2) },
  decided_by: { type: DataTypes.UUID },
  decided_at: { type: DataTypes.DATE },
  applicant_notified_at: { type: DataTypes.DATE },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'decisions' });

module.exports = Decision;
