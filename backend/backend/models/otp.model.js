const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * OTP — one row per active OTP request.
 * Security properties:
 *   - expires_at:     10-minute window. Backend rejects after expiry.
 *   - attempt_count:  Incremented on each wrong attempt. Invalidated after 3 fails.
 *   - Deleted on successful verification (no replay possible).
 *   - Cron or TTL index cleans up stale rows; only fresh rows are queried.
 */
const OTP = sequelize.define('OTP', {
  otp_id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email:         { type: DataTypes.STRING(255), allowNull: false },
  otp_hash:      { type: DataTypes.STRING(64), allowNull: false, comment: 'SHA-256 hash of the OTP code — never store plaintext' },
  expires_at:    { type: DataTypes.DATE, allowNull: false },
  attempt_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Invalidate after 3 wrong attempts' },
  purpose:       { type: DataTypes.ENUM('EMAIL_VERIFY','PASSWORD_RESET','SIGNING'), allowNull: false },
}, {
  tableName: 'otps',
  indexes:   [{ fields: ['email','purpose'] }, { fields: ['expires_at'] }],
});

module.exports = OTP;
