const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AssessmentTaxRecord = sequelize.define('AssessmentTaxRecord', {
  tax_record_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tax_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  property_address: { type: DataTypes.TEXT, allowNull: false },
  road_name: {
    type: DataTypes.STRING(255),
    comment: 'Booklet Pg06 §1: Street/road name for property',
  },
  property_type: { type: DataTypes.STRING(100) },

  // ── Booklet Pg 07 §5.1 — Land area in Sri Lankan units ────────────────────
  land_area: { type: DataTypes.DECIMAL(10,2), comment: 'Area in perches (primary unit)' },
  land_area_acres: { type: DataTypes.DECIMAL(10,4), comment: 'Booklet Pg07 §5.1' },
  land_area_roods: { type: DataTypes.DECIMAL(10,4) },
  land_area_perches: { type: DataTypes.DECIMAL(10,4) },

  // ── Booklet Pg 06 §6 — Access road ────────────────────────────────────────
  access_road_width_m: {
    type: DataTypes.DECIMAL(6,2),
    comment: 'Booklet Pg07 §6: Width of access road in metres',
  },
  access_road_ownership: {
    type: DataTypes.ENUM('RDA','PROVINCIAL_RDA','LOCAL_GOVERNMENT','PRIVATE'),
    comment: 'Booklet Pg07 §6: Who owns the access road',
  },

  annual_tax_amount: { type: DataTypes.DECIMAL(12,2) },
  tax_payment_status: { type: DataTypes.ENUM('PAID','UNPAID','ARREARS'), defaultValue: 'UNPAID' },
  last_payment_date: { type: DataTypes.DATE },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  gps_lat: { type: DataTypes.DECIMAL(10,8) },
  gps_lng: { type: DataTypes.DECIMAL(11,8) },
  ward: { type: DataTypes.STRING(100) },
  local_authority_area: { type: DataTypes.STRING(100) },
  imported_at: { type: DataTypes.DATE },
  imported_by: { type: DataTypes.UUID },
}, { tableName: 'assessment_tax_records',
  indexes: [
    { fields: ['tax_number'] },
  ], });

module.exports = AssessmentTaxRecord;
