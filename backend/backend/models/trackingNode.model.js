const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TrackingNode = sequelize.define('TrackingNode', {
  node_id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tracking_line_id:  { type: DataTypes.UUID, allowNull: false },
  reference_number:  { type: DataTypes.STRING(50), allowNull: false },
  node_type: {
    type: DataTypes.ENUM(
      'REFERENCE_NUMBER','SW_INITIAL','TO_INSPECTION','SW_REVIEW',
      'HO_APPROVAL','RDA_APPROVAL','GJS_APPROVAL','PHI_INSPECTION','SW_FINAL',
      'PC_COMMITTEE','APPROVED','REJECTED','FURTHER_REVIEW','FURTHER_REVIEW_RETURN',
      'DEFERRED','APPEAL','TIME_EXTENSION','COMPLAINT',
      'COR_APPLICATION','COR_FINAL_INSPECTION','COR_PHI_INSPECTION','COR_ISSUED','SUBMITTED', 'PAYMENT_VERIFIED', 'PSO_VERIFIED'
    ),
    allowNull: false,
  },
  label:             { type: DataTypes.STRING(255), comment: 'Display label shown to all users including applicant' },
  node_label:        { type: DataTypes.STRING(255), comment: 'Internal label alias (legacy field)' },
  status:            { type: DataTypes.ENUM('PENDING','ACTIVE','IN_PROGRESS','COMPLETED','SKIPPED'), defaultValue: 'PENDING' },
  sequence_number:   { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Used for ordering (replaces sort_order)' },
  sort_order:        { type: DataTypes.INTEGER, defaultValue: 0 },
  is_visible_to_applicant: { type: DataTypes.BOOLEAN, defaultValue: true, comment: 'If false, applicant sees node name only, not content' },
  is_appeal_node:    { type: DataTypes.BOOLEAN, defaultValue: false },
  appeal_round:      { type: DataTypes.INTEGER },
  metadata:          { type: DataTypes.JSON, comment: 'Flexible payload for conditions, notes, requirements' },
  linked_officer_id:    { type: DataTypes.UUID },
  linked_minute_id:     { type: DataTypes.UUID },
  linked_inspection_id: { type: DataTypes.UUID },
  linked_decision_id:   { type: DataTypes.UUID },
  linked_certificate_id:{ type: DataTypes.UUID },
  linked_cor_id:        { type: DataTypes.UUID },
  linked_complaint_id:  { type: DataTypes.UUID },
  started_at:        { type: DataTypes.DATE },
  completed_at:      { type: DataTypes.DATE },
  is_immutable:      { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'tracking_nodes' });

module.exports = TrackingNode;
