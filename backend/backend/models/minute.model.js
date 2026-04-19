const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Minute = sequelize.define('Minute', {
  minute_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference_number: { type: DataTypes.STRING(50), allowNull: false },
  application_id: { type: DataTypes.UUID },
  authored_by: { type: DataTypes.UUID, allowNull: false },
  minute_type: {
    type: DataTypes.ENUM(
      'SW_INITIAL_REVIEW','SW_FINAL_REVIEW','FINAL_COMPILATION',
      'HO_ASSESSMENT','RDA_ASSESSMENT','GJS_LAND_CONDITION',
      'UDA_COMPLIANCE','SUPPLEMENTARY','REVIEW','CORRECTION',
      'PC_MEETING','APPEAL','COR_REVIEW','COMPLAINT_RESPONSE',
      'TO_AMENDED_MINUTE','SW_AMENDED_MINUTE'
    ),
    allowNull: false,
  },
  content: { type: DataTypes.TEXT, allowNull: false },
  attachments: { type: DataTypes.JSON },
  status: { type: DataTypes.ENUM('DRAFT','SUBMITTED','LOCKED'), defaultValue: 'DRAFT' },
  visibility: { type: DataTypes.ENUM('OFFICERS_ONLY','ALL'), defaultValue: 'OFFICERS_ONLY' },
  external_approval_id: { type: DataTypes.UUID },
  forwarded_to: { type: DataTypes.UUID },
  forwarded_at: { type: DataTypes.DATE },
  submitted_at: { type: DataTypes.DATE },
  is_immutable: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'minutes' });

module.exports = Minute;
