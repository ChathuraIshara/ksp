const { AssessmentTaxRecord, TaxRecordOwner } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { sequelize }  = require('../models');

// ── Validation ────────────────────────────────────────────────────────────────
const validateImportData = (records) => {
  const errors = [];
  records.forEach((r, i) => {
    if (!r.tax_number)       errors.push(`Row ${i + 1}: tax_number is required`);
    if (!r.property_address) errors.push(`Row ${i + 1}: property_address is required`);
    if (r.tax_number && !/^[A-Z0-9\-\/]+$/i.test(r.tax_number))
      errors.push(`Row ${i + 1}: tax_number "${r.tax_number}" contains invalid characters`);
  });
  return errors;
};

// ── Parse CSV text into row objects ──────────────────────────────────────────
const parseCSV = (csvText) => {
  const lines = csvText.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g,'_'));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas inside
    const values = [];
    let inQuote = false, curr = '';
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { values.push(curr.trim()); curr = ''; continue; }
      curr += ch;
    }
    values.push(curr.trim());

    const row = {};
    headers.forEach((h, j) => { if (values[j] !== undefined) row[h] = values[j]; });
    if (row.tax_number) records.push(row);
  }
  return records;
};

// ── Preview — show what will be inserted vs updated, without writing ──────────
const previewImport = async (records) => {
  const errors = validateImportData(records);
  const taxNumbers = records.map(r => r.tax_number).filter(Boolean);
  const existingNumbers = await AssessmentTaxRecord.findAll({
    attributes: ['tax_number'],
    where: { tax_number: taxNumbers },
  });
  const existingSet = new Set(existingNumbers.map(e => e.tax_number));
  const toInsert = records.filter(r => !existingSet.has(r.tax_number));
  const toUpdate = records.filter(r =>  existingSet.has(r.tax_number));
  return {
    errors,
    toInsert:    toInsert.length,
    toUpdate:    toUpdate.length,
    total:       records.length,
    duplicates:  toUpdate.map(r => r.tax_number),
    canProceed:  errors.length === 0,
  };
};

// ── Execute import — upsert each record inside a transaction ──────────────────
const executeImport = async (records, importedBy) => {
  const errors = validateImportData(records);
  if (errors.length) throw new Error('Validation failed: ' + errors.join('; '));

  const ALLOWED_FIELDS = [
    'tax_number','property_address','road_name','property_type',
    'land_area','land_area_acres','land_area_roods','land_area_perches',
    'access_road_width_m','access_road_ownership','annual_tax_amount','tax_payment_status',
    'gps_lat','gps_lng','ward','local_authority_area',
  ];

  // ── Column alias normalisation ──────────────────────────────────────────────
  // The Pradeshiya Sabha office may export CSVs with slightly different column
  // names. Normalise every row before processing so nothing is silently dropped.
  const normaliseRow = (row) => {
    const r = { ...row };

    // primary_owner_name → owner_name  (frontend template uses the longer name)
    if (!r.owner_name && r.primary_owner_name) r.owner_name = r.primary_owner_name;

    // ward_number → ward  (DB column is 'ward', template column is 'ward_number')
    if (!r.ward && r.ward_number) r.ward = r.ward_number;

    // secondary_owner_name alias
    if (!r.secondary_owner && r.secondary_owner_name) r.secondary_owner = r.secondary_owner_name;

    // land_area_perches also maps to land_area (primary storage unit is perches)
    if (!r.land_area && r.land_area_perches) r.land_area = r.land_area_perches;

    // nic_number / owner_nic both acceptable
    if (!r.nic_number && r.owner_nic) r.nic_number = r.owner_nic;

    return r;
  };

  let inserted = 0, updated = 0, failed = 0;
  const failedRows = [];

  await sequelize.transaction(async (t) => {
    for (const rawRow of records) {
      const row = normaliseRow(rawRow);
      try {
        const safe = {};
        ALLOWED_FIELDS.forEach(f => { if (row[f] !== undefined && row[f] !== '') safe[f] = row[f]; });
        safe.imported_at = new Date();
        safe.imported_by = importedBy;

        const [record, created] = await AssessmentTaxRecord.findOrCreate({
          where: { tax_number: row.tax_number },
          defaults: { ...safe, is_active: true },
          transaction: t,
        });

        if (!created) {
          await record.update(safe, { transaction: t });
          updated++;
        } else {
          inserted++;
        }

        // Save primary owner — check all accepted column name variants
        const ownerName = row.owner_name || row.primary_owner_name;
        if (ownerName) {
          await TaxRecordOwner.findOrCreate({
            where: { tax_record_id: record.tax_record_id, is_primary: true },
            defaults: {
              owner_name:  ownerName,
              nic_number:  row.nic_number  || row.owner_nic   || null,
              contact_phone: row.phone       || row.owner_phone || row.contact_phone || null,
              address:     row.owner_address || record.property_address,
              is_primary:  true,
              is_active:   true,
            },
            transaction: t,
          });
        }
      } catch (e) {
        failed++;
        failedRows.push({ tax_number: row.tax_number, error: e.message });
        // Don't throw — continue with remaining rows
      }
    }
  });

  return { inserted, updated, failed, failedRows, total: records.length };
};

module.exports = { validateImportData, previewImport, executeImport, parseCSV };
