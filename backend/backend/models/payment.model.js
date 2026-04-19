const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  payment_id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number:  { type: DataTypes.STRING(50) },
  application_id:    { type: DataTypes.UUID },
  payment_type: {
    type: DataTypes.ENUM(
      'APPLICATION_FEE','APPROVAL_FEE','EXTENSION_FEE',
      'COR_FEE','APPEAL_FEE','FINE_PAYMENT','LATE_COR_FEE'
    ),
    allowNull: false,
  },
  amount:            { type: DataTypes.DECIMAL(12,2), allowNull: false },
  payment_method: {
    type: DataTypes.ENUM('ONLINE', 'CASH', 'CHEQUE', 'BANK_SLIP', 'PAYHERE', 'COUNTER_CASH'),
    allowNull: false,
  },
  payment_status: {
    type: DataTypes.ENUM('PENDING','COMPLETED','FAILED','REFUNDED'),
    defaultValue: 'PENDING',
  },
  transaction_id:    { type: DataTypes.STRING(100) },
  order_id:          { type: DataTypes.STRING(150), comment: 'PayHere order_id used to match webhook callback' },
  gateway_reference: { type: DataTypes.STRING(255) },
  gateway_response:  { type: DataTypes.JSON },
  receipt_number:    { type: DataTypes.STRING(50) },
  receipt_path:      { type: DataTypes.STRING(500) },
  rejection_note:    { type: DataTypes.TEXT, comment: 'PSO rejection reason when verifying bank slip' },
  pso_verified_by:   { type: DataTypes.UUID, comment: 'PSO user who verified the bank slip' },
  pso_verified_at:   { type: DataTypes.DATE },
  recorded_by:       { type: DataTypes.UUID },
  paid_at:           { type: DataTypes.DATE },
  is_immutable:      { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'payments',
  indexes: [
    { fields: ['reference_number'] },
    { fields: ['payment_status'] },
    { fields: ['application_id'] },
  ], });

module.exports = Payment;
