const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Complaint = sequelize.define('Complaint', {
  complaint_id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tax_number:          { type: DataTypes.STRING(50), allowNull: false },
  reference_number:    { type: DataTypes.STRING(50) },
  complainant_name:    { type: DataTypes.STRING(255), allowNull: false },
  complainant_contact: { type: DataTypes.STRING(100) },
  complainant_nic:     { type: DataTypes.STRING(20) },
  complaint_type:      { type: DataTypes.STRING(100) },
  description:         { type: DataTypes.TEXT, allowNull: false },
  evidence_paths:      { type: DataTypes.JSON },
  status:              { type: DataTypes.ENUM('PENDING','IN_REVIEW','RESOLVED','DISMISSED'), defaultValue: 'PENDING' },

  // Single officer directly assigned to action the complaint
  assigned_to:         { type: DataTypes.UUID },

  // The 4 officers who must all be reminded weekly per spec
  // Populated automatically when a complaint is linked to a reference number
  sw_id:               { type: DataTypes.UUID, comment: 'SW responsible for the application on this tax number' },
  to_id:               { type: DataTypes.UUID, comment: 'TO who inspected the property on this tax number' },
  pso_id:              { type: DataTypes.UUID, comment: 'PSO who processed the application on this tax number' },
  chairman_id:         { type: DataTypes.UUID, comment: 'Chairman — always notified' },

  resolved_by:         { type: DataTypes.UUID },
  resolved_at:         { type: DataTypes.DATE },
  resolution_note:     { type: DataTypes.TEXT },
  resolution_minute_id:{ type: DataTypes.UUID },
  last_reminder_sent:  { type: DataTypes.DATE },
  reminder_count:      { type: DataTypes.INTEGER, defaultValue: 0 },
  is_public:           { type: DataTypes.BOOLEAN, defaultValue: false },
  is_post_approval:    { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'True when complaint was filed within 5 hours of application approval' },
}, { tableName: 'complaints',
  indexes: [
    { fields: ['reference_number'] },
    { fields: ['tax_number'] },
    { fields: ['status'] },
  ], });

module.exports = Complaint;
