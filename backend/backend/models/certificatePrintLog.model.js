const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CertificatePrintLog = sequelize.define('CertificatePrintLog', {
  print_log_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  certificate_id: { type: DataTypes.UUID },
  certificate_type: { type: DataTypes.ENUM('APPROVAL','COR'), allowNull: false },
  reference_number: { type: DataTypes.STRING(50) },
  print_number: { type: DataTypes.INTEGER, allowNull: false },
  printed_by: { type: DataTypes.UUID, allowNull: false },
  printed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  reason: { type: DataTypes.TEXT },
  chairman_notified: { type: DataTypes.BOOLEAN, defaultValue: false },
  chairman_notified_at: { type: DataTypes.DATE },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'certificate_print_logs' });

module.exports = CertificatePrintLog;
