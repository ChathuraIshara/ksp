const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  user_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: true, comment: 'Null for Google OAuth users' },
  role: {
    type: DataTypes.ENUM(
      'APPLICANT','PSO','SW','TO',
      'PHI',         // Public Health Inspector — Booklet Pg14 mandatory signatory
      'HO','RDA','GJS','UDA','CHAIRMAN','ADMIN','PUBLIC'
    ),
    allowNull: false,
  },
  status: { type: DataTypes.ENUM('PENDING_VERIFICATION','ACTIVE','SUSPENDED','REJECTED'), defaultValue: 'PENDING_VERIFICATION' },
  is_verified:    { type: DataTypes.BOOLEAN, defaultValue: false },
  // Reference pattern field names
  isBlocked:      { type: DataTypes.BOOLEAN, defaultValue: false,  comment: 'Admin block — matches reference pattern' },
  emailVerified:  { type: DataTypes.BOOLEAN, defaultValue: false,  comment: 'Email OTP verified — replaces first_login_verified' },
  otp_code: { type: DataTypes.STRING(10) },
  otp_expires_at: { type: DataTypes.DATE },
  reset_token: { type: DataTypes.STRING(255), comment: 'Hashed password reset token' },
  reset_token_expires_at: { type: DataTypes.DATE, comment: 'Reset token expiry — 1 hour' },
  last_login:             { type: DataTypes.DATE },
  first_login_verified:   { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'OTP verified once — skip 2FA on future logins' },
  google_id:              { type: DataTypes.STRING(255), comment: 'Google OAuth sub claim' },
  auth_provider:          { type: DataTypes.ENUM('LOCAL','GOOGLE'), defaultValue: 'LOCAL' },
  refresh_token: { type: DataTypes.TEXT },
  jwt_token: { type: DataTypes.TEXT, allowNull: true, comment: 'Stored permanent JWT — returned on every login' },
}, { tableName: 'users' });

module.exports = User;
