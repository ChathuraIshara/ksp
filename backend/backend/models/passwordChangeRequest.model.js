const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PasswordChangeRequest = sequelize.define('PasswordChangeRequest', {
  request_id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:           { type: DataTypes.UUID, allowNull: false },
  new_password_hash: { type: DataTypes.STRING(255), allowNull: false, comment: 'Pre-hashed new password' },
  status:            { type: DataTypes.ENUM('PENDING','APPROVED','REJECTED'), defaultValue: 'PENDING' },
  requested_at:      { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  resolved_at:       { type: DataTypes.DATE },
  resolved_by:       { type: DataTypes.UUID },
  reject_reason:     { type: DataTypes.TEXT },
}, {
  tableName: 'password_change_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
});

module.exports = PasswordChangeRequest;