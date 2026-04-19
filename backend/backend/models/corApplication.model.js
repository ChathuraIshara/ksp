const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CORApplication = sequelize.define('CORApplication', {
  cor_application_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  applicant_id: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('SUBMITTED','ELIGIBILITY_CHECK','FEE_PENDING','INSPECTION_SCHEDULED','INSPECTION_DONE','ISSUED','REFUSED'), defaultValue: 'SUBMITTED' },
  completion_photos: { type: DataTypes.JSON },
  compliance_statement: { type: DataTypes.TEXT },
  notes: { type: DataTypes.TEXT, comment: 'Additional PSO/officer notes at COR submission' },
  cor_fee_amount: { type: DataTypes.DECIMAL(12,2) },
  late_fine_id: { type: DataTypes.UUID },
  payment_id: { type: DataTypes.UUID },
  eligibility_checked_at: { type: DataTypes.DATE },
  approval_snapshot_expiry: { type: DataTypes.DATE },
  submitted_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'cor_applications',
  indexes: [
    { fields: ['reference_number'] },
    { fields: ['applicant_id'] },
  ], });

module.exports = CORApplication;
