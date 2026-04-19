const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FinalInspection = sequelize.define('FinalInspection', {
  final_inspection_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  cor_application_id: { type: DataTypes.UUID, allowNull: false },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  officer_id: { type: DataTypes.UUID, allowNull: false },
  conversation_id: { type: DataTypes.UUID },
  status: { type: DataTypes.ENUM('SCHEDULED','CONDUCTED','REPORT_SUBMITTED','COMPLETED'), defaultValue: 'SCHEDULED' },
  scheduled_date: { type: DataTypes.DATE },
  conducted_date: { type: DataTypes.DATE },

  // ── COR Report §07: Sections A–L compliance check ────────────────────────
  // Spec: "Are the constructed parts of the building in accordance with the approved plan?
  //        (Sections A through L for detailed checking)"
  plan_compliance_sections: {
    type: DataTypes.JSON,
    comment: 'COR §07: { sectionA: bool, sectionB: bool, ... sectionL: bool, notes: string } — constructed parts vs approved plan',
  },
  plan_compliance_notes: {
    type: DataTypes.TEXT,
    comment: 'COR §07: Narrative on any deviations from approved plan',
  },

  // ── COR Report §08: Other matters ────────────────────────────────────────
  other_matters: {
    type: DataTypes.TEXT,
    comment: 'COR §08: Any other relevant matters observed during final inspection',
  },

  // ── COR Report §09: Boundary distances ───────────────────────────────────
  boundaries_maintained: {
    type: DataTypes.BOOLEAN,
    comment: 'COR §09: Have distances to land boundaries been maintained per approved site plan?',
  },

  // ── COR Report §10: Water supply ─────────────────────────────────────────
  water_well_type: {
    type: DataTypes.ENUM('PROTECTED','UNPROTECTED','NOT_APPLICABLE'),
    comment: 'COR §10a: Well water type',
  },
  water_pipe_available: {
    type: DataTypes.BOOLEAN,
    comment: 'COR §10b: Pipe-borne water available?',
  },
  water_pipe_details: {
    type: DataTypes.STRING(255),
    comment: 'COR §10b: Details if pipe water not available',
  },

  // ── COR Report §11: Toilet facilities ────────────────────────────────────
  toilet_available: {
    type: DataTypes.BOOLEAN,
    comment: 'COR §11: Toilet facilities available?',
  },
  toilet_type: {
    type: DataTypes.ENUM('PIT_LATRINE','WATER_SEALED','OTHER'),
    comment: 'COR §11: Type of toilet facility',
  },

  // ── COR Report §12: Bathrooms ────────────────────────────────────────────
  bathroom_available: {
    type: DataTypes.BOOLEAN,
    comment: 'COR §12: Bathrooms available?',
  },

  // ── COR Report §13: Surface drainage ─────────────────────────────────────
  surface_drainage_available: {
    type: DataTypes.BOOLEAN,
    comment: 'COR §13: Surface drainage system available?',
  },
  surface_drainage_type: {
    type: DataTypes.STRING(100),
    comment: 'COR §13: e.g. Cement drains, Other',
  },

  // ── COR Report §14: Electricity ──────────────────────────────────────────
  electricity_available: {
    type: DataTypes.BOOLEAN,
    comment: 'COR §14: Electricity connection available?',
  },

  // ── COR Report §15: Occupancy ────────────────────────────────────────────
  building_occupied: {
    type: DataTypes.BOOLEAN,
    comment: 'COR §15: Is the building currently occupied?',
  },

  // ── COR Report §16: Floor area ───────────────────────────────────────────
  constructed_floor_area_sqft: {
    type: DataTypes.DECIMAL(10,2),
    comment: 'COR §16: Floor area of constructed portion in square feet',
  },

  // ── COR Report §17: Conditions fulfilled ─────────────────────────────────
  approval_conditions_fulfilled: {
    type: DataTypes.BOOLEAN,
    comment: 'COR §17: Have the conditions imposed during plan approval been fulfilled?',
  },
  unfulfilled_conditions: {
    type: DataTypes.TEXT,
    comment: 'COR §17: Details of any unfulfilled conditions',
  },

  // ── COR Report §18: TO recommendation ────────────────────────────────────
  compliance_status: { type: DataTypes.ENUM('FULL_COMPLIANCE','MINOR_DEVIATIONS','MAJOR_DEVIATIONS') },
  deviations: { type: DataTypes.TEXT },
  deviation_severity: { type: DataTypes.ENUM('MINOR','MAJOR') },
  photos: { type: DataTypes.JSON },
  comparison_notes: { type: DataTypes.TEXT },
  recommendation: { type: DataTypes.ENUM('ISSUE_COR','ISSUE_COR_WITH_NOTES','CORRECTION_REQUIRED','NEW_APPLICATION') },
  report_notes: { type: DataTypes.TEXT, comment: 'COR §18: TO final recommendation narrative' },
  report_submitted_at: { type: DataTypes.DATE },
  drafted_offline: { type: DataTypes.BOOLEAN, defaultValue: false },
  synced_at: { type: DataTypes.DATE },
}, { tableName: 'final_inspections',
  indexes: [
    { fields: ['reference_number'] },
    { fields: ['officer_id'] },
  ], });

module.exports = FinalInspection;
