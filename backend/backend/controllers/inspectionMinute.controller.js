const { InspectionMinute, Fine, Application, Inspection, TaskAssignment } = require('../models');
const { Op } = require('sequelize');
const fineService = require('../services/fineCalculator.service');
const feeService  = require('../services/feeCalculator.service');
const lockdownService = require('../services/lockdown.service');
const notifEvents = require('../services/notificationEvents.service');
const { success, created, notFound, error, badRequest } = require('../utils/responseHelper');

exports.createMinute = async (req, res, next) => {
  try {
    const { inspection_id } = req.body;
    if (!inspection_id) return badRequest(res, 'inspection_id is required');
    const inspection = await Inspection.findByPk(inspection_id);
    if (!inspection) return notFound(res, 'Inspection not found');
    // Prevent duplicate minutes on same inspection
    const existing = await InspectionMinute.findOne({ where: { inspection_id } });
    if (existing) return badRequest(res, 'A minute already exists for this inspection. Use the draft/update endpoint.');
    return created(res, await InspectionMinute.create({ ...req.body, officer_id: req.user.user_id }));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const m = await InspectionMinute.findByPk(req.params.id);
    if (!m) return notFound(res);
    return success(res, m);
  } catch (err) { next(err); }
};

exports.getByInspection = async (req, res, next) => {
  try { return success(res, await InspectionMinute.findOne({ where: { inspection_id: req.params.inspectionId } })); } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try { return success(res, await InspectionMinute.findAll({ where: { reference_number: req.params.ref } })); } catch (err) { next(err); }
};

exports.saveDraft = async (req, res, next) => {
  try {
    const m = await InspectionMinute.findByPk(req.params.id);
    if (!m) return notFound(res);
    // Whitelist all TO-editable draft fields. Status is forced to DRAFT server-side.
    // is_immutable, officer_id, phi_* fields, fine amounts are never writable here.
    const ALLOWED = [
      'site_conditions','site_area_measured','building_area_measured',
      'wall_length_measured','floor_count','building_height_measured_m',
      'setback_compliant','setback_notes',
      'setback_road_centre_m','setback_rear_m','setback_right_m','setback_left_m',
      'height_compliant','height_notes',
      'far_compliant','far_notes','far_allowed','far_proposed',
      'is_flood_zone','slldc_clearance_ok','obstructs_natural_drainage','adjacent_land_nature',
      'zoning_classification','zoning_compliant',
      'plot_coverage_allowed_pct','plot_coverage_proposed_pct',
      'open_space_sqm','power_line_distance_m',
      'parking_required','parking_provided',
      'light_ventilation_adequate','open_space_rear_adequate','open_space_front_adequate',
      'construction_already_started','construction_stage','to_remarks',
      'compliance_observations','to_recommendation',
      'drafted_offline','offline_draft_data',
    ];
    const safe = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) safe[key] = req.body[key];
    }
    await m.update({ ...safe, status: 'DRAFT' });
    return success(res, m);
  } catch (err) { next(err); }
};

exports.submitMinute = async (req, res, next) => {
  try {
    const m = await InspectionMinute.findByPk(req.params.id);
    if (!m) return notFound(res);
    await m.update({ status: 'SUBMITTED', submitted_at: new Date() });
    await lockdownService.lockRecord(InspectionMinute, req.params.id);

    // Auto-advance application status: INSPECTION_SCHEDULED → INSPECTION_DONE
    // This surfaces the application in SW's pending reviews queue automatically
    try {
      const { Application } = require('../models');
      const appService = require('../services/application.service');
      const app = await Application.findOne({ where: { reference_number: m.reference_number } });
      if (app?.status === 'INSPECTION_SCHEDULED') {
        await appService.forceTransition(app.application_id, 'INSPECTION_DONE');
      }
    } catch (advanceErr) {
      // Non-fatal — minute is locked regardless of status advance
      console.error('[INSPECTION MINUTE] Status advance error:', advanceErr.message);
    }

    // Mark related TO inspection task(s) as completed so SW workload reflects reduction
    try {
      await TaskAssignment.update(
        { status: 'COMPLETED', completed_at: new Date() },
        {
          where: {
            reference_number: m.reference_number,
            task_type: { [Op.in]: ['TO_INSPECTION', 'SUPPLEMENTARY_INSPECTION'] },
            status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] },
          },
        }
      );
    } catch (taskErr) {
      // Non-fatal — minute submission should succeed even if task auto-completion fails
      console.error('[INSPECTION MINUTE] Task completion error:', taskErr.message);
    }

    return success(res, null, 'Minute submitted and locked');
  } catch (err) { next(err); }
};

exports.addMeasurements = async (req, res, next) => {
  try {
    // Whitelist — only allow measurement fields. Status, officer_id, is_immutable,
    // phi_* fields, and fine amounts must never come from this endpoint.
    const ALLOWED = [
      'site_area_measured','building_area_measured','wall_length_measured','floor_count',
      'building_height_measured_m',
      'setback_road_centre_m','setback_rear_m','setback_right_m','setback_left_m',
      'far_allowed','far_proposed',
      'plot_coverage_allowed_pct','plot_coverage_proposed_pct',
      'open_space_sqm','power_line_distance_m',
      'parking_required','parking_provided',
    ];
    const safe = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) safe[key] = req.body[key];
    }
    await InspectionMinute.update(safe, { where: { minute_id: req.params.id } });
    return success(res, null, 'Measurements saved');
  } catch (err) { next(err); }
};

exports.uploadPhotos = async (req, res, next) => {
  try {
    if (!req.files?.length) return error(res, 'No files uploaded', 400);
    const m = await InspectionMinute.findByPk(req.params.id);
    if (!m) return notFound(res);
    const photos = [...(m.photos || []), ...req.files.map(f => f.path)];
    await m.update({ photos });
    return success(res, { photos });
  } catch (err) { next(err); }
};

exports.setComplianceStatus = async (req, res, next) => {
  try {
    await InspectionMinute.update({ setback_compliant: req.body.setback, height_compliant: req.body.height, far_compliant: req.body.far, compliance_observations: req.body.observations }, { where: { minute_id: req.params.id } });
    return success(res, null, 'Compliance status saved');
  } catch (err) { next(err); }
};

exports.verifySetback = async (req, res, next) => {
  try {
    await InspectionMinute.update({ setback_compliant: req.body.compliant, setback_notes: req.body.notes }, { where: { minute_id: req.params.id } });
    return success(res, null, 'Setback verified');
  } catch (err) { next(err); }
};

exports.verifyHeight = async (req, res, next) => {
  try {
    await InspectionMinute.update({ height_compliant: req.body.compliant, height_notes: req.body.notes }, { where: { minute_id: req.params.id } });
    return success(res, null, 'Height verified');
  } catch (err) { next(err); }
};

exports.verifyFAR = async (req, res, next) => {
  try {
    await InspectionMinute.update({ far_compliant: req.body.compliant, far_notes: req.body.notes }, { where: { minute_id: req.params.id } });
    return success(res, null, 'FAR verified');
  } catch (err) { next(err); }
};

exports.flagUnauthorizedConstruction = async (req, res, next) => {
  try {
    const { unauthorized_sqft, plan_type_id, fine_reason } = req.body;
    const m = await InspectionMinute.findByPk(req.params.id);
    if (!m) return notFound(res);

    // Calculate fine using gazette rates (fineCalculator.service.js)
    const resolvedPlanTypeId = plan_type_id || m.plan_type_id ||
      (await Application.findOne({ where: { reference_number: m.reference_number }, attributes: ['plan_type_id'] }))?.plan_type_id;

    const fineAmount = await fineService.calculateUnauthorizedFine(
      parseFloat(unauthorized_sqft),
      resolvedPlanTypeId
    );

    // Update minute with fine details
    await m.update({
      unauthorized_construction:  true,
      unauthorized_sqft:          parseFloat(unauthorized_sqft),
      calculated_fine_amount:     fineAmount,
    });

    // UC19: Create Fine record so applicant can pay it
    const { Fine, Application, Applicant, Payment } = require('../models');
    const app = await Application.findOne({ where: { reference_number: m.reference_number } });
    if (app) {
      // Create the fine record
      await Fine.create({
        application_id:   app.application_id,
        reference_number: m.reference_number,
        fine_type:        'UNAUTHORIZED_CONSTRUCTION',
        fine_amount:      fineAmount,
        reason:           fine_reason || `Unauthorized construction detected during inspection. Area: ${unauthorized_sqft} sq.ft.`,
        raised_by:        req.user.user_id,
        payment_status:   'PENDING',
      });

      // Create payment record so it appears in applicant's Pay Fees section
      await Payment.create({
        application_id:   app.application_id,
        reference_number: m.reference_number,
        payment_type:     'FINE_PAYMENT',
        amount:           fineAmount,
        payment_status:   'PENDING',
      });

      // UC19: Update application status — applicant must pay fine before proceeding
      await Application.update(
        { status: 'PAYMENT_PENDING' },
        { where: { reference_number: m.reference_number } }
      );

      // Notify applicant
      setImmediate(async () => {
        try {
          const notifEvents = require('../services/notificationEvents.service');
          const applicant = await Applicant.findByPk(app.applicant_id, { attributes: ['user_id','phone'] });
          if (applicant?.user_id) {
            await notifEvents.emit('FINE_ISSUED', {
              referenceNumber: m.reference_number,
              applicantId:     applicant.user_id,
              applicantPhone:  applicant.phone,
            });
          }
        } catch (e) { console.error('[UNAUTHORIZED] Applicant notify failed:', e.message); }
      });
    }

    return success(res, {
      unauthorized_sqft: parseFloat(unauthorized_sqft),
      fineAmount,
      fine_type: 'UNAUTHORIZED_CONSTRUCTION',
      message: 'Unauthorized construction flagged. Fine created. Applicant notified. Application status set to PAYMENT_PENDING.',
    });
  } catch (err) { next(err); }
};

exports.autoCalculateFee = async (req, res, next) => {
  try {
    const m = await InspectionMinute.findByPk(req.params.id);
    if (!m) return notFound(res);

    // Re-calculate using gazette-correct banded fee table
    const app = await Application.findOne({ where: { reference_number: m.reference_number } });
    let calculatedApprovalFee = m.calculated_approval_fee;

    if (app && (m.building_area_measured || m.site_area_measured)) {
      const sqft = Number(m.building_area_measured || m.site_area_measured || 0);
      try {
        calculatedApprovalFee = await feeService.calculateBuildingFee(app.plan_type_id, sqft);
        await m.update({ calculated_approval_fee: calculatedApprovalFee });
      } catch { /* keep existing value if plan type lookup fails */ }
    }

    return success(res, {
      calculated_fine_amount: m.calculated_fine_amount,
      calculated_approval_fee: calculatedApprovalFee,
    });
  } catch (err) { next(err); }
};

exports.syncOfflineDraft = async (req, res, next) => {
  try {
    await InspectionMinute.update({ ...req.body, drafted_offline: true, synced_at: new Date() }, { where: { minute_id: req.params.id } });
    return success(res, null, 'Synced');
  } catch (err) { next(err); }
};

/**
 * PUT /inspection-minutes/:id/edit-submitted
 *
 * Spec: TO can edit a submitted/done minute. The PREVIOUS version must be
 * snapshotted into the tracking line (labeled "edited") so the diff is visible
 * when extracting the TO node.
 *
 * Flow:
 *  1. Load existing minute — reject if not SUBMITTED or locked
 *  2. Snapshot old values into a tracking node (type: MINUTE_EDITED)
 *  3. Apply new values
 *  4. The tracking node payload contains { previous, updated, edited_by, edited_at }
 */
exports.editSubmittedMinute = async (req, res, next) => {
  try {
    const m = await InspectionMinute.findByPk(req.params.id);
    if (!m) return notFound(res, 'Inspection minute not found');
    if (m.is_immutable) return require('../utils/responseHelper').forbidden(res, 'This minute is permanently locked and cannot be edited');
    if (m.status === 'DRAFT') return badRequest(res, 'Use /save-draft for DRAFT minutes');

    // Editable fields for post-submission amendment
    const EDITABLE = [
      'site_conditions', 'site_area_measured', 'building_area_measured',
      'wall_length_measured', 'floor_count', 'building_height_measured_m',
      'setback_compliant', 'setback_notes',
      'setback_road_centre_m', 'setback_rear_m', 'setback_right_m', 'setback_left_m',
      'height_compliant', 'height_notes',
      'far_compliant', 'far_notes', 'far_allowed', 'far_proposed',
      'is_flood_zone', 'slldc_clearance_ok', 'obstructs_natural_drainage', 'adjacent_land_nature',
      'zoning_classification', 'zoning_compliant',
      'plot_coverage_allowed_pct', 'plot_coverage_proposed_pct',
      'open_space_sqm', 'power_line_distance_m',
      'parking_required', 'parking_provided',
      'light_ventilation_adequate', 'open_space_rear_adequate', 'open_space_front_adequate',
      'construction_already_started', 'construction_stage',
      'to_remarks', 'to_recommendation', 'compliance_observations',
      'industry_nature', 'environmental_pollution', 'cea_required', 'fire_safety_certificate',
      'traffic_congestion', 'hp_rating', 'employee_capacity', 'employee_facilities_adequate',
      'warehouse_materials', 'drainage_system_available',
      'surface_drain_details', 'waste_water_drain_details',
      'waste_disposal_details', 'rainwater_harvesting_details',
    ];

    // ── Snapshot previous values into tracking line ───────────────────────
    const previousValues = {};
    const updatedValues  = {};
    for (const key of EDITABLE) {
      if (req.body[key] !== undefined && String(req.body[key]) !== String(m[key] ?? '')) {
        previousValues[key] = m[key];
        updatedValues[key]  = req.body[key];
      }
    }

    if (Object.keys(updatedValues).length === 0) {
      return badRequest(res, 'No changes detected. Submit different values to record an edit.');
    }

    try {
      const { TrackingLine } = require('../models');
      const trackingLineService = require('../services/trackingLine.service');
      const line = await TrackingLine.findOne({ where: { reference_number: m.reference_number } });
      if (line) {
        await trackingLineService.addNode(
          line.tracking_line_id,
          m.reference_number,
          'MINUTE_EDITED',
          `TO Inspection Minute Amended by ${req.user.user_id}`,
          {
            minute_id:   m.minute_id,
            edited_by:   req.user.user_id,
            edited_at:   new Date().toISOString(),
            previous:    previousValues,
            updated:     updatedValues,
          }
        );
      }
    } catch (trackErr) {
      console.error('[MINUTE EDIT] Tracking snapshot error:', trackErr.message);
      // Non-fatal — still apply the edit
    }

    // ── Apply new values ──────────────────────────────────────────────────
    const safe = {};
    for (const key of EDITABLE) {
      if (req.body[key] !== undefined) safe[key] = req.body[key];
    }
    await m.update(safe);

    return success(res, m, 'Minute updated. Previous version recorded in tracking line.');
  } catch (err) { next(err); }
};

exports.lockMinute = async (req, res, next) => {
  try {
    await lockdownService.lockRecord(InspectionMinute, req.params.id);
    return success(res, null, 'Minute locked');
  } catch (err) { next(err); }
};

exports.syncOfflineMinute = async (req, res, next) => {
  try {
    const { InspectionMinute } = require('../models');
    const { notFound, success, error } = require('../utils/responseHelper');
    const minute = await InspectionMinute.findByPk(req.params.id);
    if (!minute) return notFound(res, 'Inspection minute not found');
    if (minute.is_immutable) return require('../utils/responseHelper').forbidden(res, 'This minute is locked');
    await minute.update({ ...req.body, drafted_offline: true, synced_at: new Date(), offline_draft_data: null });
    return success(res, minute, 'Offline minute synced');
  } catch (err) { require('../utils/responseHelper').error(res, err.message); }
};
