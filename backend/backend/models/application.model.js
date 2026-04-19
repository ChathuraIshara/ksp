const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Application = sequelize.define('Application', {
  application_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), unique: true },
  applicant_id: { type: DataTypes.UUID, allowNull: false },
  tax_record_id: { type: DataTypes.UUID, allowNull: true, comment: 'NULL until PSO links via AssessmentTaxRecord lookup' },
  tax_number: { type: DataTypes.STRING(50), comment: 'Denormalized for PSO quick search; canonical FK is via tax_record_id' },
  plan_type_id: { type: DataTypes.UUID, allowNull: false },
  sub_plan_type: {
    type: DataTypes.STRING(100),
    comment: 'Subtype selected by applicant e.g. residential, residential-commercial, commercial, industrial, whole-land, subdivided, standard-wall, rda-wall',
  },
  story_type: {
    type: DataTypes.ENUM('SINGLE_STORY','MULTI_STORY'),
    comment: 'Required for building fee calculation (single vs multi-story rate)',
  },
  submission_mode: { type: DataTypes.ENUM('ONLINE','WALK_IN'), allowNull: false },
  physical_copies_count:          { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Number of physical plan copies received (manual: must be 3)' },
  physical_copies_confirmed:      { type: DataTypes.BOOLEAN, defaultValue: false },
  physical_copies_confirmed_by:   { type: DataTypes.UUID, comment: 'PSO who confirmed the 3 copies' },
  registered_by:                  { type: DataTypes.UUID, comment: 'PSO who registered a walk-in application' },

  // ── Booklet Pg 06 Part II §2 — Work type ──────────────────────────────────
  work_type: {
    type: DataTypes.ENUM('NEW_CONSTRUCTION','RECONSTRUCTION','ADDITION','ALTERATION'),
    comment: 'Booklet Pg06 §2: Purpose of application',
  },

  // ── Booklet Pg 06 Part II §3 — Previous plan reference ───────────────────
  previous_plan_number: {
    type: DataTypes.STRING(50),
    comment: 'Booklet Pg06 §3: Previous plan number for additions/alterations',
  },

  // ── Booklet Pg 06 Part II §4 — Existing vs proposed use ──────────────────
  existing_use: {
    type: DataTypes.ENUM('RESIDENTIAL','COMMERCIAL','INDUSTRIAL','PUBLIC','OTHER'),
    comment: 'Booklet Pg06 §4: Current use of the property',
  },
  proposed_use: {
    type: DataTypes.ENUM('RESIDENTIAL','COMMERCIAL','INDUSTRIAL','PUBLIC','OTHER'),
    comment: 'Booklet Pg06 §4: Intended use after construction',
  },

  // ── Booklet Pg 03 Part I §3 — Land ownership type ────────────────────────
  land_ownership_type: {
    type: DataTypes.ENUM('FREEHOLD','LEASE','RENT','OTHER'),
    comment: 'Booklet Pg06 Part I §3: How applicant holds the land',
  },
  land_ownership_notes: { type: DataTypes.STRING(255) },

  // ── Booklet Pg 07 §7 — Distances to boundaries ───────────────────────────
  distance_to_road_centre_m: {
    type: DataTypes.DECIMAL(8,2),
    comment: 'Booklet Pg07 §7: Metres from road centre line',
  },
  distance_to_rear_boundary_m: { type: DataTypes.DECIMAL(8,2) },
  distance_to_right_boundary_m: { type: DataTypes.DECIMAL(8,2) },
  distance_to_left_boundary_m: { type: DataTypes.DECIMAL(8,2) },

  // ── Booklet Pg 07 §8 — Building dimensions ───────────────────────────────
  building_height_m: {
    type: DataTypes.DECIMAL(8,2),
    comment: 'Booklet Pg07 §8: Total building height in metres',
  },
  inter_floor_height_m: {
    type: DataTypes.DECIMAL(8,2),
    comment: 'Booklet Pg07 §8: Height between floors',
  },

  // ── Booklet Pg 07 §9 — Building materials ────────────────────────────────
  wall_material: {
    type: DataTypes.STRING(100),
    comment: 'Booklet Pg07 §9: e.g. Brick, Cement block',
  },
  roof_material: {
    type: DataTypes.STRING(100),
    comment: 'Booklet Pg07 §9: e.g. Tile, Asbestos, Concrete slab',
  },
  floor_material: {
    type: DataTypes.STRING(100),
    comment: 'Booklet Pg07 §9: e.g. Tile, Cement',
  },

  // ── Booklet Pg 08 §10 — Waste disposal ───────────────────────────────────
  wastewater_disposal: {
    type: DataTypes.STRING(200),
    comment: 'Booklet Pg08 §10: e.g. Septic tank, Municipal sewer',
  },
  sewage_disposal: { type: DataTypes.STRING(200) },
  solid_waste_disposal: { type: DataTypes.STRING(200) },
  rainwater_disposal: { type: DataTypes.STRING(200) },

  // ── Booklet Pg 08 §11 — Per-floor area breakdown (stored as JSON) ─────────
  floor_areas: {
    type: DataTypes.JSON,
    comment: 'Booklet Pg08 §11: { basement:{existing,proposed}, ground:{existing,proposed}, first:{existing,proposed}, second:{existing,proposed} } all in sq.ft',
  },

  // ── Booklet Pg 08 §12 — Industrial/commercial operational details ─────────
  business_nature: { type: DataTypes.STRING(255) },
  materials_stored: { type: DataTypes.TEXT },
  machinery_hp: { type: DataTypes.DECIMAL(10,2) },
  expected_employees: { type: DataTypes.INTEGER },
  number_of_rooms: { type: DataTypes.INTEGER },
  raw_materials_used: { type: DataTypes.TEXT },
  waste_discharged: { type: DataTypes.TEXT },

  // ── Booklet Pg 08 §13–15 ─────────────────────────────────────────────────
  has_air_conditioning: { type: DataTypes.BOOLEAN, defaultValue: false },
  ac_cert_ref: { type: DataTypes.STRING(100) },
  generator_hp: { type: DataTypes.DECIMAL(10,2) },
  parking_spaces_provided: {
    type: DataTypes.INTEGER,
    comment: 'Booklet Pg08 §15: Number of parking spaces shown in plan',
  },

  // ── Booklet Pg 09 §16 — Owner consent ────────────────────────────────────
  owner_consent_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Booklet Pg09 §16: True when applicant != landowner',
  },
  owner_consent_name: { type: DataTypes.STRING(255) },
  owner_consent_address: { type: DataTypes.TEXT },
  owner_consent_phone: { type: DataTypes.STRING(20) },
  owner_consent_signature_path: { type: DataTypes.STRING(500) },
  owner_consent_date: { type: DataTypes.DATE },

  // ── Booklet Pg 09 top — Applicant declaration ────────────────────────────
  applicant_declaration_accepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Booklet Pg09: Applicant declares no work until permit granted',
  },
  declaration_accepted_at: { type: DataTypes.DATE },

  // ── Professional details (Booklet Pg06 Part I §5) ─────────────────────────
  professional_name: {
    type: DataTypes.STRING(255),
    comment: 'Booklet Pg06 §5: Architect/Draughtsman who prepared plans',
  },
  professional_designation: { type: DataTypes.STRING(100) },
  professional_address: { type: DataTypes.TEXT },
  professional_phone: { type: DataTypes.STRING(20) },
  professional_reg_number: {
    type: DataTypes.STRING(50),
    comment: 'Registration number of qualified person per UDA Act',
  },

  // ── Booklet Pg 05 §5.2 — Subdivision plan ────────────────────────────────
  subdivision_plan_approved: { type: DataTypes.BOOLEAN },
  subdivision_plan_ref: { type: DataTypes.STRING(100) },
  subdivision_plan_date: { type: DataTypes.DATE },

  // ── Booklet Pg 05 §5.3 — Nature of land ──────────────────────────────────
  land_nature: {
    type: DataTypes.ENUM('HIGHLAND','FLAT','LOW_LYING','PADDY','MARSHY','SLOPED','FLOOD_PRONE'),
    comment: 'Booklet Pg07 §5.3: Land classification',
  },

  // ── Original fields retained ──────────────────────────────────────────────
  construction_description: { type: DataTypes.TEXT },
  site_area: { type: DataTypes.DECIMAL(10,2) },
  building_floors: { type: DataTypes.INTEGER },
  building_area:    { type: DataTypes.DECIMAL(10,2) },
  floor_height_m:   { type: DataTypes.DECIMAL(5,2), comment: '§8 Height between floors in metres' },
  wall_length: { type: DataTypes.DECIMAL(10,2) },

  // Floor area breakdown per level (PDF Part II §11)
  ground_floor_area:  { type: DataTypes.DECIMAL(10,2) },
  basement_area:      { type: DataTypes.DECIMAL(10,2) },
  first_floor_area:   { type: DataTypes.DECIMAL(10,2) },
  second_floor_area:  { type: DataTypes.DECIMAL(10,2) },

  // Waste management (PDF Part II §10)
  waste_management_kitchen:   { type: DataTypes.STRING(255) },
  waste_management_toilet:    { type: DataTypes.STRING(255) },
  waste_management_other:     { type: DataTypes.STRING(255) },
  waste_management_rainwater: { type: DataTypes.STRING(255) },

  // Document issue flag — set by PSO; gates applicant edit access
  has_document_issue_notification: { type: DataTypes.BOOLEAN, defaultValue: false },

  status: {
    type: DataTypes.ENUM(
      'DRAFT','PAYMENT_PENDING','SUBMITTED','PSO_REVIEW','VERIFIED',
      'ASSIGNED_TO_SW','ASSIGNED_TO_TO','INSPECTION_SCHEDULED','INSPECTION_DONE',
      'SW_REVIEW','EXTERNAL_APPROVAL','PC_REVIEW','APPROVED','CONDITIONALLY_APPROVED',
      'REJECTED','FURTHER_REVIEW','DEFERRED','APPEAL_PENDING','APPEAL_IN_REVIEW',
      'APPROVAL_FEE_PENDING','CERTIFICATE_READY','COR_PENDING','COR_REVIEW',
      'COR_ISSUED','CLOSED','EXPIRED'
    ),
    defaultValue: 'DRAFT',
  },
  stage: { type: DataTypes.STRING(100) },
  approval_date: { type: DataTypes.DATE },
  approval_expiry_date: { type: DataTypes.DATE },
  extension_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tracks extensions granted. Booklet allows max 2.',
  },
  reminder_6month_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
  reminder_3month_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
  reminder_1month_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
  expiry_fine_applied: { type: DataTypes.BOOLEAN, defaultValue: false },
  rejection_reason: { type: DataTypes.TEXT },
  requires_ho: { type: DataTypes.BOOLEAN, defaultValue: false },
  requires_rda: { type: DataTypes.BOOLEAN, defaultValue: false },
  requires_gjs: { type: DataTypes.BOOLEAN, defaultValue: false },
  ref_receipt_path: { type: DataTypes.STRING(500) },
  submitted_at: { type: DataTypes.DATE },

  // ── Booklet Pg02 — Route map (digital replacement for hand-drawn sketch) ──
  map_lat: {
    type: DataTypes.DECIMAL(10,8),
    comment: 'Booklet Pg02: GPS latitude of the property (replaces hand-drawn route map)',
  },
  map_lng: {
    type: DataTypes.DECIMAL(11,8),
    comment: 'Booklet Pg02: GPS longitude of the property',
  },
  map_place_description: {
    type: DataTypes.STRING(500),
    comment: 'Booklet Pg02: Human-readable place name / landmark description for TO to find the site',
  },
  map_route_notes: {
    type: DataTypes.TEXT,
    comment: 'Booklet Pg02: Additional directions or landmark notes from applicant',
  },
}, { tableName: 'applications',
  indexes: [
    { fields: ['reference_number'] },
    { fields: ['applicant_id'] },
    { fields: ['status'] },
    { fields: ['submission_mode'] },
    { fields: ['plan_type_id'] },
  ], });

module.exports = Application;
