const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TimeExtension = sequelize.define('TimeExtension', {
  extension_id:     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id:   { type: DataTypes.UUID, allowNull: false },
  requested_by:     { type: DataTypes.UUID, allowNull: false },

  extension_number: {
    type: DataTypes.INTEGER, allowNull: false, defaultValue: 1,
    comment: 'Max 2 extensions allowed. 1 = first, 2 = second (final)',
  },
  extension_years:  {
    type: DataTypes.INTEGER, allowNull: false, defaultValue: 1,
    comment: 'Number of years to extend by',
  },
  extension_months: { type: DataTypes.INTEGER, comment: 'Legacy field kept for compatibility' },

  reason:           { type: DataTypes.TEXT },
  old_expiry_date:  { type: DataTypes.DATE },
  new_expiry_date:  { type: DataTypes.DATE },

  status: {
    type: DataTypes.ENUM('PENDING','APPROVED','REJECTED'),
    defaultValue: 'PENDING',
  },

  fee_amount:       { type: DataTypes.DECIMAL(12,2) },
  payment_id:       { type: DataTypes.UUID },

  // Approval fields
  granted_by:       { type: DataTypes.UUID,  comment: 'Officer who approved the extension' },
  granted_at:       { type: DataTypes.DATE },

  // Rejection fields
  rejected_by:      { type: DataTypes.UUID,  comment: 'Officer who rejected the extension' },
  rejected_at:      { type: DataTypes.DATE },
  rejection_reason: { type: DataTypes.TEXT },

  // Legacy alias
  reviewed_by:      { type: DataTypes.UUID },
  reviewed_at:      { type: DataTypes.DATE },
}, { tableName: 'time_extensions' });

module.exports = TimeExtension;
