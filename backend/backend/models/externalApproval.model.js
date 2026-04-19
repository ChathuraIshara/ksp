const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExternalApproval = sequelize.define('ExternalApproval', {
  approval_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID, allowNull: false },
  officer_type: { type: DataTypes.ENUM('HO','RDA','GJS','PHI'), allowNull: false },
  officer_id: { type: DataTypes.UUID },
  approval_status: { type: DataTypes.ENUM('PENDING','IN_REVIEW','APPROVED','REJECTED','RETURNED'), defaultValue: 'PENDING' },
  minute_id: { type: DataTypes.UUID },
  forwarded_by: { type: DataTypes.UUID },
  forwarded_at: { type: DataTypes.DATE },
  due_date: {
    type: DataTypes.DATE,
    comment: '14-day SLA from forwarded_at — set automatically on forward',
  },
  is_overdue: {
    type: DataTypes.VIRTUAL,
    get() {
      if (!this.due_date) return false;
      if (['APPROVED','REJECTED','RETURNED'].includes(this.approval_status)) return false;
      return new Date() > new Date(this.due_date);
    },
  },
  returned_at: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
  sw_comments: { type: DataTypes.TEXT, comment: 'SW comments when forwarding' },
  minute_content: { type: DataTypes.TEXT, comment: 'External officer assessment/minute text' },
  minute_document_path: { type: DataTypes.STRING(500) },
  submitted_at: { type: DataTypes.DATE },
  requires_waiver: { type: DataTypes.BOOLEAN, defaultValue: false },
  waiver_uploaded: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'external_approvals' });

module.exports = ExternalApproval;
