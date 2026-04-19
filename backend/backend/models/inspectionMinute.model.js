const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InspectionMinute = sequelize.define('InspectionMinute', {
  minute_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  inspection_id: { type: DataTypes.UUID, allowNull: false },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  officer_id: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('DRAFT','SUBMITTED','LOCKED'), defaultValue: 'DRAFT' },

  // ── Site conditions ────────────────────────────────────────────────────────
  site_conditions: { type: DataTypes.TEXT },
  site_area_measured: { type: DataTypes.DECIMAL(10,2) },
  building_area_measured: { type: DataTypes.DECIMAL(10,2) },
  wall_length_measured: { type: DataTypes.DECIMAL(10,2) },
  floor_count: { type: DataTypes.INTEGER },

  // ── Setback, height, FAR ──────────────────────────────────────────────────
  setback_compliant: { type: DataTypes.BOOLEAN },
  setback_notes: { type: DataTypes.TEXT },
  setback_road_centre_m: { type: DataTypes.DECIMAL(8,2), comment: 'Measured distance from road centre' },
  setback_rear_m: { type: DataTypes.DECIMAL(8,2) },
  setback_right_m: { type: DataTypes.DECIMAL(8,2) },
  setback_left_m: { type: DataTypes.DECIMAL(8,2) },
  height_compliant: { type: DataTypes.BOOLEAN },
  height_notes: { type: DataTypes.TEXT },
  building_height_measured_m: { type: DataTypes.DECIMAL(8,2) },
  far_compliant: { type: DataTypes.BOOLEAN },
  far_notes: { type: DataTypes.TEXT },
  far_allowed: { type: DataTypes.DECIMAL(6,3) },
  far_proposed: { type: DataTypes.DECIMAL(6,3) },

  // ── Booklet Pg 10–11: Inspection checklist fields ─────────────────────────
  is_flood_zone: {
    type: DataTypes.BOOLEAN,
    comment: 'Booklet Pg10 §1: Is development in flood-prone area?',
  },
  slldc_clearance_ok: {
    type: DataTypes.BOOLEAN,
    comment: 'Booklet Pg10 §2: Outside SLLDC flood retention areas?',
  },
  obstructs_natural_drainage: {
    type: DataTypes.BOOLEAN,
    comment: 'Booklet Pg10 §3: Does development obstruct natural water flow?',
  },
  adjacent_land_nature: {
    type: DataTypes.TEXT,
    comment: 'Booklet Pg10 §4: Nature of developments on neighbouring land',
  },
  zoning_classification: {
    type: DataTypes.ENUM('RESIDENTIAL','COMMERCIAL','INDUSTRIAL','PUBLIC','MIXED','AGRICULTURAL'),
    comment: 'Booklet Pg10 §7: Zone per development plan',
  },
  zoning_compliant: {
    type: DataTypes.BOOLEAN,
    comment: 'Booklet Pg10 §8: Is development compatible with zone?',
  },
  plot_coverage_allowed_pct: {
    type: DataTypes.DECIMAL(5,2),
    comment: 'Booklet Pg10 §9.3: UDA-allowed plot coverage %',
  },
  plot_coverage_proposed_pct: {
    type: DataTypes.DECIMAL(5,2),
    comment: 'Booklet Pg10 §9.4: Proposed plot coverage %',
  },
  open_space_sqm: {
    type: DataTypes.DECIMAL(10,2),
    comment: 'Booklet Pg10 §9.7: Open space area in sq.metres',
  },
  power_line_distance_m: {
    type: DataTypes.DECIMAL(8,2),
    comment: 'Booklet Pg10 §9.10: Distance from power lines to building',
  },
  parking_required: {
    type: DataTypes.INTEGER,
    comment: 'Booklet Pg11 §11.1: Parking spaces required by standards',
  },
  parking_provided: {
    type: DataTypes.INTEGER,
    comment: 'Booklet Pg11 §11.2: Parking spaces shown in plan',
  },
  light_ventilation_adequate: {
    type: DataTypes.BOOLEAN,
    comment: 'Booklet Pg11 §12: Adequate light and ventilation?',
  },
  open_space_rear_adequate: {
    type: DataTypes.BOOLEAN,
    comment: 'Booklet Pg11 §13: Open space rear adequate?',
  },
  open_space_front_adequate: {
    type: DataTypes.BOOLEAN,
    comment: 'Booklet Pg11 §13: Open space front adequate?',
  },
  construction_already_started: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Booklet Pg14 §15: Has construction already begun?',
  },
  construction_stage: {
    type: DataTypes.ENUM('FOUNDATION','FLOOR_LEVEL','WITH_ROOF','COMPLETED'),
    comment: 'Booklet Pg14 §15: Stage if already started',
  },
  to_remarks: {
    type: DataTypes.TEXT,
    comment: 'Booklet Pg14 §16: Other remarks by inspector',
  },

  // ── PHI report fields (Booklet Pg14 — Public Health Inspector) ────────────
  phi_name: { type: DataTypes.STRING(255) },
  phi_report_date: { type: DataTypes.DATE },
  phi_signature_path: { type: DataTypes.STRING(500) },
  phi_septic_tank_distance_ok: {
    type: DataTypes.BOOLEAN,
    comment: 'PHI verification: septic tank >= 50ft from well',
  },
  phi_sanitation_adequate: { type: DataTypes.BOOLEAN },
  phi_report_notes: { type: DataTypes.TEXT },

  // ── Original fields ────────────────────────────────────────────────────────
  compliance_observations: { type: DataTypes.TEXT },
  unauthorized_construction: { type: DataTypes.BOOLEAN, defaultValue: false },
  unauthorized_sqft: { type: DataTypes.DECIMAL(10,2) },
  calculated_fine_amount: { type: DataTypes.DECIMAL(12,2) },
  calculated_approval_fee: { type: DataTypes.DECIMAL(12,2) },

  // §9.8–§9.9 Land subdivision
  subdivision_plan_approved_q:  { type: DataTypes.BOOLEAN, comment: '§9.8 Subdivision plan approved?' },
  land_extents_ok:              { type: DataTypes.BOOLEAN, comment: '§9.9 Can build within land extents?' },

  // ── §6 — New construction / addition / alteration ────────────────────────
  // Spec Q6: Is the proposed development a new construction, addition, or alteration?
  construction_type: {
    type: DataTypes.ENUM('NEW_CONSTRUCTION','ADDITION','ALTERATION','RECONSTRUCTION'),
    comment: '§6: Nature of work — new, addition, alteration, reconstruction',
  },

  // ── §9.1 / §9.2 — Measurement context labels ─────────────────────────────
  // Measurements are stored in site_area_measured / building_area_measured / wall_length_measured.
  // These store the UNITS used at time of measurement for audit clarity.
  site_area_unit: {
    type: DataTypes.ENUM('PERCHES','SQM','SQFT'),
    defaultValue: 'PERCHES',
    comment: '§9.1: Unit used for land extent measurement',
  },
  building_area_unit: {
    type: DataTypes.ENUM('SQM','SQFT'),
    defaultValue: 'SQM',
    comment: '§9.2: Unit used for building area measurement',
  },

  // ── §10 — Access Road details ─────────────────────────────────────────────
  // Spec Q10.1–10.4: road ownership, width, building line, compliance
  road_ownership: {
    type: DataTypes.ENUM('GOVERNMENT','LOCAL_AUTHORITY','PUBLIC','PRIVATE'),
    comment: '§10.1: Ownership classification of the access road',
  },
  road_width_ft: {
    type: DataTypes.DECIMAL(6,2),
    comment: '§10.2: Width of the access road in feet',
  },
  building_line_dev_plan_m: {
    type: DataTypes.DECIMAL(6,2),
    comment: '§10.3: Relevant building line per development plan (metres)',
  },
  road_building_line_compliant: {
    type: DataTypes.BOOLEAN,
    comment: '§10.4: Is development compliant with street line and building line in §10.3?',
  },

  // ── §13 Open space for light and ventilation ──────────────────────────────
  // Spec Q13: Adequacy of open space — rear, front, light & ventilation
  // open_space_rear_adequate and open_space_front_adequate already exist above.
  open_space_light_ventilation_adequate: {
    type: DataTypes.BOOLEAN,
    comment: '§13: Is open space for light and ventilation adequate?',
  },

  // §14 Industry-specific
  industry_nature:              { type: DataTypes.STRING(255) },
  environmental_pollution:      { type: DataTypes.BOOLEAN },
  cea_required:                 { type: DataTypes.BOOLEAN },
  fire_safety_certificate:      { type: DataTypes.BOOLEAN },
  traffic_congestion:           { type: DataTypes.BOOLEAN },
  hp_rating:                    { type: DataTypes.DECIMAL(10,2) },
  employee_capacity:            { type: DataTypes.INTEGER },
  employee_facilities_adequate: { type: DataTypes.BOOLEAN },
  warehouse_materials:          { type: DataTypes.TEXT },

  // §15 Drainage system
  drainage_system_available:    { type: DataTypes.BOOLEAN },
  surface_drain_details:        { type: DataTypes.STRING(500) },
  waste_water_drain_details:    { type: DataTypes.STRING(500) },
  waste_disposal_details:       { type: DataTypes.STRING(500) },
  rainwater_harvesting_details: { type: DataTypes.STRING(500) },

  photos: { type: DataTypes.JSON },
  to_recommendation: { type: DataTypes.TEXT },
  submitted_at: { type: DataTypes.DATE },
  drafted_offline: { type: DataTypes.BOOLEAN, defaultValue: false },
  synced_at: { type: DataTypes.DATE },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'inspection_minutes' });

module.exports = InspectionMinute;
