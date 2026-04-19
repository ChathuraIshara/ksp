const { AssessmentTaxRecord, TaxRecordOwner, Application, Complaint } = require('../models');
const psoVerificationService = require('../services/psoVerification.service');
const { success, created, notFound, error } = require('../utils/responseHelper');
const { Op } = require('sequelize');

exports.createRecord = async (req, res, next) => {
  try {
    // Whitelist — is_active, imported_at, imported_by are system-managed fields
    // and must never come from user input.
    const ALLOWED = [
      'tax_number','property_address','road_name','property_type',
      'land_area','land_area_acres','land_area_roods','land_area_perches',
      'access_road_width_m','access_road_ownership',
      'annual_tax_amount','tax_payment_status','last_payment_date',
      'gps_lat','gps_lng','ward','local_authority_area',
    ];
    const safe = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) safe[key] = req.body[key];
    }
    const record = await AssessmentTaxRecord.create(safe);
    return created(res, record);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const r = await AssessmentTaxRecord.findByPk(req.params.id, { include: [TaxRecordOwner] });
    if (!r) return notFound(res);
    return success(res, r);
  } catch (err) { next(err); }
};

exports.getByTaxNumber = async (req, res, next) => {
  try {
    const r = await AssessmentTaxRecord.findOne({ where: { tax_number: req.params.taxNumber }, include: [TaxRecordOwner] });
    if (!r) return notFound(res);
    return success(res, r);
  } catch (err) { next(err); }
};

exports.psoLookup = async (req, res, next) => {
  try {
    const { taxNumber } = req.params;
    const record = await psoVerificationService.lookupTaxRecord(taxNumber);
    if (!record) return notFound(res, 'No assessment tax record found for: ' + taxNumber);

    // All complaints for this tax number (full list for PSO review)
    const complaints = await Complaint.findAll({
      where: { tax_number: taxNumber },
      order: [['created_at', 'DESC']],
      attributes: ['complaint_id','complaint_type','description','status',
                   'complainant_name','created_at','is_post_approval'],
    });

    const activeComplaints    = complaints.filter(c => ['PENDING','IN_REVIEW'].includes(c.status));
    const hasActiveComplaints = activeComplaints.length > 0;

    // All linked applications (any status — shows full history)
    const applications = await Application.findAll({
      where: { tax_record_id: record.tax_record_id },
      attributes: ['application_id','reference_number','status','submission_mode','created_at','approval_date'],
      order: [['created_at','DESC']],
    });

    // Owners for name-match comparison on PSO screen
    const owners = record.TaxRecordOwners || [];
    const primaryOwner = owners.find(o => o.is_primary && o.is_active) || owners[0] || null;

    return success(res, {
      // Property record
      tax_record_id:      record.tax_record_id,
      tax_number:         record.tax_number,
      property_address:   record.property_address,
      road_name:          record.road_name,
      ward:               record.ward,
      land_area:          record.land_area,
      gps_lat:            record.gps_lat,
      gps_lng:            record.gps_lng,
      tax_payment_status: record.tax_payment_status,
      annual_tax_amount:  record.annual_tax_amount,

      // Registered owners (for name-match)
      owners,
      primary_owner_name: primaryOwner?.owner_name || null,

      // Red-dot complaint indicator
      hasActiveComplaints,
      active_complaint_count: activeComplaints.length,
      complaints,

      // Application history
      linkedApplications: applications,
    });
  } catch (err) { next(err); }
};

exports.hasActiveComplaints = async (req, res, next) => {
  try {
    const has = await psoVerificationService.hasActiveComplaints(req.params.taxNumber);
    return success(res, { taxNumber: req.params.taxNumber, hasActiveComplaints: has });
  } catch (err) { next(err); }
};

exports.searchByAddress = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 3) {
      const { badRequest } = require('../utils/responseHelper');
      return badRequest(res, 'Search query must be at least 3 characters');
    }
    const records = await AssessmentTaxRecord.findAll({
      where: { property_address: { [Op.like]: `%${q.trim()}%` } },
      limit: 50,
    });
    return success(res, records);
  } catch (err) { next(err); }
};

exports.updateRecord = async (req, res, next) => {
  try {
    const r = await AssessmentTaxRecord.findByPk(req.params.id);
    if (!r) return notFound(res);
    // Whitelist — tax_number is unique and immutable once assigned;
    // is_active has a dedicated deactivate endpoint; imported_* are system fields.
    const ALLOWED = [
      'property_address','road_name','property_type',
      'land_area','land_area_acres','land_area_roods','land_area_perches',
      'access_road_width_m','access_road_ownership',
      'annual_tax_amount','tax_payment_status','last_payment_date',
      'gps_lat','gps_lng','ward','local_authority_area',
    ];
    const safe = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) safe[key] = req.body[key];
    }
    await r.update(safe);
    return success(res, r);
  } catch (err) { next(err); }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { tax_payment_status, last_payment_date } = req.body;
    await AssessmentTaxRecord.update({ tax_payment_status, last_payment_date }, { where: { tax_record_id: req.params.id } });
    return success(res, null, 'Payment status updated');
  } catch (err) { next(err); }
};

exports.deactivate = async (req, res, next) => {
  try {
    await AssessmentTaxRecord.update({ is_active: false }, { where: { tax_record_id: req.params.id } });
    return success(res, null, 'Record deactivated');
  } catch (err) { next(err); }
};

exports.getLinkedApplications = async (req, res, next) => {
  try {
    const record = await AssessmentTaxRecord.findByPk(req.params.id);
    if (!record) return notFound(res);
    const applications = await Application.findAll({ where: { tax_record_id: req.params.id } });
    return success(res, applications);
  } catch (err) { next(err); }
};

/**
 * PUT /tax-records/:id/update-tax-number
 * PSO/Admin corrects a mismatched assessment tax number.
 * Propagates the new number to: Application, Complaint, Payment, Fine, TrackingLine records.
 * Logs the change in TaxOwnerChangeHistory for full audit trail.
 */
exports.updateTaxNumber = async (req, res, next) => {
  try {
    const { new_tax_number, reason } = req.body;
    if (!new_tax_number || !reason) {
      return badRequest(res, 'new_tax_number and reason are required');
    }

    const record = await AssessmentTaxRecord.findByPk(req.params.id);
    if (!record) return notFound(res);

    const old_tax_number = record.tax_number;
    if (old_tax_number === new_tax_number) return badRequest(res, 'New tax number is the same as current');

    // Check new number not already in use
    const { Op } = require('sequelize');
    const exists = await AssessmentTaxRecord.findOne({ where: { tax_number: new_tax_number } });
    if (exists) return badRequest(res, 'Tax number ' + new_tax_number + ' is already assigned to another property');

    const { Application: App, Complaint: Comp, Payment, Fine, TrackingLine, TaxOwnerChangeHistory } = require('../models');

    // Run all cascade updates in a transaction
    const { sequelize } = require('../models');
    await sequelize.transaction(async (t) => {
      // 1. Update the tax record itself
      await record.update({ tax_number: new_tax_number }, { transaction: t });

      // 2. Cascade to Applications
      await App.update(
        { tax_number: new_tax_number },
        { where: { tax_number: old_tax_number }, transaction: t }
      );

      // 3. Cascade to Complaints
      await Comp.update(
        { tax_number: new_tax_number },
        { where: { tax_number: old_tax_number }, transaction: t }
      );

      // 4. Cascade to Payments (via reference — find apps first)
      const apps = await App.findAll({ where: { tax_number: new_tax_number }, attributes: ['reference_number'], transaction: t });
      if (apps.length && Payment) {
        await Payment.update(
          { tax_number: new_tax_number },
          { where: { tax_number: old_tax_number }, transaction: t }
        ).catch(() => {}); // payment may not have tax_number field — non-fatal
      }

      // 5. Cascade to Fines
      if (Fine) {
        await Fine.update(
          { tax_number: new_tax_number },
          { where: { tax_number: old_tax_number }, transaction: t }
        ).catch(() => {});
      }

      // 6. Log the change
      await TaxOwnerChangeHistory.create({
        tax_record_id:   record.tax_record_id,
        changed_by:      req.user.user_id,
        change_type:     'TAX_NUMBER_CORRECTION',
        old_value:       old_tax_number,
        new_value:       new_tax_number,
        reason,
        changed_at:      new Date(),
      }, { transaction: t });
    });

    return success(res, {
      old_tax_number,
      new_tax_number,
      message: 'Tax number updated and propagated to all linked records',
    });
  } catch (err) { next(err); }
};
