const { FinalInspection, CORApplication, Application } = require('../models');
const lockdownService = require('../services/lockdown.service');
const offlineSyncService = require('../services/offlineSync.service');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.createFinalInspection = async (req, res, next) => {
  try {
    const inspection = await FinalInspection.create({ ...req.body, officer_id: req.body.officer_id || req.user.user_id });
    return created(res, inspection);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const i = await FinalInspection.findByPk(req.params.id);
    if (!i) return notFound(res);
    return success(res, i);
  } catch (err) { next(err); }
};

exports.getByCOR = async (req, res, next) => {
  try {
    const i = await FinalInspection.findOne({ where: { cor_application_id: req.params.corId } });
    if (!i) return notFound(res);
    return success(res, i);
  } catch (err) { next(err); }
};

exports.scheduleFinalInspection = async (req, res, next) => {
  try {
    await FinalInspection.update({ scheduled_date: req.body.scheduled_date, status: 'SCHEDULED' }, { where: { final_inspection_id: req.params.id } });
    return success(res, null, 'Final inspection scheduled');
  } catch (err) { next(err); }
};

exports.conductInspection = async (req, res, next) => {
  try {
    // Whitelist — only allow safe field updates; never expose status or officer_id to injection
    const { compliance_status, deviation_severity, comparison_notes, report_notes, recommendation } = req.body;
    await FinalInspection.update({
      conducted_date:    new Date(),
      status:            'CONDUCTED',
      compliance_status: compliance_status  || null,
      deviation_severity:deviation_severity || null,
      comparison_notes:  comparison_notes   || null,
      report_notes:      report_notes       || null,
      recommendation:    recommendation     || null,
    }, { where: { final_inspection_id: req.params.id } });
    return success(res, null, 'Inspection marked as conducted');
  } catch (err) { next(err); }
};

exports.assessCompliance = async (req, res, next) => {
  try {
    const { compliance_status, deviation_severity } = req.body;
    await FinalInspection.update({ compliance_status, deviation_severity }, { where: { final_inspection_id: req.params.id } });
    return success(res, null, 'Compliance assessed');
  } catch (err) { next(err); }
};

exports.documentDeviations = async (req, res, next) => {
  try {
    await FinalInspection.update({ deviations: req.body.deviations, deviation_severity: req.body.severity }, { where: { final_inspection_id: req.params.id } });
    return success(res, null, 'Deviations documented');
  } catch (err) { next(err); }
};

exports.compareWithApprovedPlan = async (req, res, next) => {
  try {
    await FinalInspection.update({ comparison_notes: req.body.notes }, { where: { final_inspection_id: req.params.id } });
    return success(res, null, 'Comparison notes saved');
  } catch (err) { next(err); }
};

exports.uploadPhotos = async (req, res, next) => {
  try {
    if (!req.files?.length) return error(res, 'No photos uploaded', 400);
    const i = await FinalInspection.findByPk(req.params.id);
    if (!i) return notFound(res);
    const photos = [...(i.photos || []), ...req.files.map(f => f.path)];
    await i.update({ photos });
    return success(res, { photos });
  } catch (err) { next(err); }
};

exports.submitReport = async (req, res, next) => {
  try {
    const i = await FinalInspection.findByPk(req.params.id);
    if (!i) return notFound(res);
    await i.update({
      status: 'REPORT_SUBMITTED',
      recommendation: req.body.recommendation,
      report_notes: req.body.notes,
      report_submitted_at: new Date(),
    });
    await lockdownService.lockRecord(FinalInspection, req.params.id);
    return success(res, null, 'Report submitted and locked');
  } catch (err) { next(err); }
};

exports.handleMajorDeviation = async (req, res, next) => {
  try {
    const i = await FinalInspection.findByPk(req.params.id);
    if (!i) return notFound(res);
    await i.update({ compliance_status: 'MAJOR_DEVIATIONS', recommendation: req.body.action });
    // Update COR application status
    await CORApplication.update({ status: 'REFUSED' }, { where: { cor_application_id: i.cor_application_id } });
    const response = {
      final_inspection_id: i.final_inspection_id,
      action: req.body.action || 'START_NEW_APPLICATION',
      message: req.body.action === 'CORRECTION_REQUIRED'
        ? 'Correction required — re-inspection will be scheduled with same TO'
        : 'Major deviation — applicant must start a new application',
    };
    return success(res, response);
  } catch (err) { next(err); }
};

exports.rescheduleAfterCorrection = async (req, res, next) => {
  try {
    const i = await FinalInspection.findByPk(req.params.id);
    if (!i) return notFound(res);
    const newInspection = await FinalInspection.create({
      cor_application_id: i.cor_application_id,
      reference_number: i.reference_number,
      officer_id: i.officer_id,
      scheduled_date: req.body.scheduled_date,
      status: 'SCHEDULED',
    });
    return created(res, newInspection, 'Re-inspection scheduled with same TO');
  } catch (err) { next(err); }
};

exports.saveDraftOffline = async (req, res, next) => {
  try {
    await FinalInspection.update({ drafted_offline: true, ...req.body }, { where: { final_inspection_id: req.params.id } });
    return success(res, null, 'Offline draft saved');
  } catch (err) { next(err); }
};

exports.syncOfflineDraft = async (req, res, next) => {
  try {
    await offlineSyncService.syncFinalInspection(req.params.id, req.body);
    return success(res, null, 'Offline draft synced');
  } catch (err) { next(err); }
};

// GET /final-inspections/ref/:ref — lookup by application reference number
exports.getByRef = async (req, res, next) => {
  try {
    const { CORApplication } = require('../models');
    const corApp = await CORApplication.findOne({ where: { reference_number: req.params.ref } });
    if (!corApp) return notFound(res, 'COR application not found for this reference');
    const inspection = await FinalInspection.findOne({ where: { cor_application_id: corApp.cor_application_id } });
    if (!inspection) return notFound(res, 'Final inspection not found');
    return success(res, inspection);
  } catch (err) { next(err); }
};
