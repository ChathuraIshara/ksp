const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appeal = sequelize.define('Appeal', {
  appeal_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  original_decision_id: { type: DataTypes.UUID, allowNull: true, comment: 'NULL if appeal is against PSO rejection; SET if against PC decision' },
  appeal_round: { type: DataTypes.INTEGER, defaultValue: 1 },
  appeal_reason: { type: DataTypes.TEXT, allowNull: false },
  revised_documents: { type: DataTypes.JSON },
  supporting_documents: { type: DataTypes.JSON },
  status: { type: DataTypes.ENUM('DRAFT','SUBMITTED','IN_REVIEW','UNDER_REVIEW','DECIDED'), defaultValue: 'DRAFT' },
  appeal_fee: { type: DataTypes.DECIMAL(12,2) },
  payment_id: { type: DataTypes.UUID },
  submitted_at: { type: DataTypes.DATE },
  decision_id: { type: DataTypes.UUID },
  applicant_notified_at: { type: DataTypes.DATE },
}, { tableName: 'appeals' });

module.exports = Appeal;
