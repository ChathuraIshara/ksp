const taxImportService = require('../services/taxImport.service');
const { success, badRequest } = require('../utils/responseHelper');
const fs = require('fs');

// Helper: parse records from either file upload or JSON body
const getRecords = async (req) => {
  // If file uploaded via multer, read and parse CSV
  if (req.file) {
    const csvText = fs.readFileSync(req.file.path, 'utf8');
    // Clean up temp file
    fs.unlink(req.file.path, () => {});
    return taxImportService.parseCSV(csvText);
  }
  // Fallback: JSON body
  return req.body.records || [];
};

// POST /tax-import/preview — parse CSV and return preview without writing
exports.previewImport = async (req, res, next) => {
  try {
    const records = await getRecords(req);
    if (!records.length) return badRequest(res, 'No records found. Ensure the CSV has a header row and at least one data row.');
    const preview = await taxImportService.previewImport(records);
    // Attach sample rows for display
    preview.sample = records.slice(0, 5);
    preview.valid_count   = preview.canProceed ? records.length - preview.errors.length : 0;
    preview.error_count   = preview.errors.length;
    preview.duplicate_count = preview.toUpdate;
    // Store parsed records in session-like body for confirm step
    preview._records = records;
    return success(res, preview);
  } catch (err) { next(err); }
};

// POST /tax-import/validate — validate without preview
exports.validateImportFile = async (req, res, next) => {
  try {
    const records = await getRecords(req);
    const errors = taxImportService.validateImportData(records);
    return success(res, { valid: errors.length === 0, errors, total: records.length });
  } catch (err) { next(err); }
};

// POST /tax-import/upload — full upload: parse + validate + import in one step
exports.bulkImportTaxRecords = async (req, res, next) => {
  try {
    const records = await getRecords(req);
    if (!records.length) return badRequest(res, 'No records found in file.');
    const result = await taxImportService.executeImport(records, req.user.user_id);
    return success(res, {
      ...result,
      valid_count: result.inserted + result.updated,
      error_count: result.failed,
    }, `Import complete: ${result.inserted} new, ${result.updated} updated, ${result.failed} failed`);
  } catch (err) { next(err); }
};

// POST /tax-import/confirm — confirm import after preview (re-uploads file or uses JSON records)
exports.confirmImport = async (req, res, next) => {
  try {
    const records = await getRecords(req);
    if (!records.length) return badRequest(res, 'No records to import.');
    const result = await taxImportService.executeImport(records, req.user.user_id);
    return success(res, {
      ...result,
      valid_count: result.inserted + result.updated,
    }, 'Import completed');
  } catch (err) { next(err); }
};

// GET /tax-import/history
exports.getImportHistory = async (req, res, next) => {
  try {
    const { sequelize } = require('../models');
    // Return unique import batches grouped by imported_at date
    const [rows] = await sequelize.query(`
      SELECT
        DATE(imported_at) as imported_date,
        imported_by,
        COUNT(*) as records_imported,
        'COMPLETED' as status
      FROM assessment_tax_records
      WHERE imported_by IS NOT NULL
      GROUP BY DATE(imported_at), imported_by
      ORDER BY imported_date DESC
      LIMIT 50
    `);
    return success(res, rows);
  } catch (err) { next(err); }
};
