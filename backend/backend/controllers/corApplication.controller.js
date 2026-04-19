const { CORApplication, Application, Fine, Payment, TaskAssignment } = require('../models');
const corWorkflow = require('../services/corWorkflow.service');
const fineService = require('../services/fineCalculator.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

exports.createCORApplication = async (req, res, next) => {
  try {
    const { reference_number } = req.body;
    const app = await Application.findOne({ where: { reference_number } });
    if (!app) return notFound(res, 'Application not found');
    // Whitelist — never allow status, payment_id, late_fine_id to be injected
    const { reference_number: _rn, completion_date, compliance_statement, notes } = req.body;
    const corApp = await CORApplication.create({
      reference_number:    reference_number,
      application_id:      app.application_id,
      applicant_id:        app.applicant_id,
      completion_date:     completion_date     || null,
      compliance_statement:compliance_statement || null,
      notes:               notes               || null,
      status:              'SUBMITTED',
      submitted_at:        new Date(),
    });

    // Spec: "TO is the one who did previous inspection will only notify and escalate to his workload"
    // Create a COR_INSPECTION TaskAssignment for the original TO + notify TO and SW
    setImmediate(async () => {
      try {
        const notifEvents = require('../services/notificationEvents.service');
        const { User } = require('../models');
        const toId = await corWorkflow.getOriginalTO(reference_number);
        const swList = await User.findAll({ where: { role: 'SW', status: 'ACTIVE' }, attributes: ['user_id'], limit: 2 });

        // Create TaskAssignment in TO workload labelled as COR
        if (toId) {
          await TaskAssignment.create({
            reference_number: reference_number,
            application_id:   app.application_id,
            assigned_to:      toId,
            assigned_by:      app.applicant_id, // system-assigned from applicant action
            task_type:        'COR_INSPECTION',
            priority:         'NORMAL',
            notes:            `COR inspection requested — applicant has declared construction complete`,
            status:           'PENDING',
          });
        }

        await notifEvents.emit('COR_REQUESTED', {
          referenceNumber: reference_number,
          toId,
          swId: swList[0]?.user_id,
        });
      } catch (e) { console.error('[COR] Request notify/task failed:', e.message); }
    });

    return created(res, corApp);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const corApp = await CORApplication.findOne({
      where: { reference_number: req.params.ref },
      include: [{ model: Application }],
    });
    if (!corApp) return notFound(res);
    return success(res, corApp);
  } catch (err) { next(err); }
};

exports.uploadCompletionPhotos = async (req, res, next) => {
  try {
    if (!req.files?.length) return badRequest(res, 'No photos uploaded');
    const corApp = await CORApplication.findByPk(req.params.id);
    if (!corApp) return notFound(res);
    const photos = [...(corApp.completion_photos || []), ...req.files.map(f => f.path)];
    await corApp.update({ completion_photos: photos });
    return success(res, { completion_photos: photos });
  } catch (err) { next(err); }
};

exports.addComplianceStatement = async (req, res, next) => {
  try {
    await CORApplication.update({ compliance_statement: req.body.statement }, { where: { cor_application_id: req.params.id } });
    return success(res, null, 'Compliance statement saved');
  } catch (err) { next(err); }
};

exports.checkCOREligibility = async (req, res, next) => {
  try {
    const corApp = await CORApplication.findByPk(req.params.id);
    if (!corApp) return notFound(res);
    const result = await corWorkflow.checkCOREligibility(corApp.application_id);
    await corApp.update({ eligibility_checked_at: new Date() });
    return success(res, result);
  } catch (err) { next(err); }
};

exports.calculateCORFee = async (req, res, next) => {
  try {
    const corApp = await CORApplication.findByPk(req.params.id, { include: [{ model: Application }] });
    if (!corApp) return notFound(res);
    const feeConfig = await require('../services/feeCalculator.service').getActiveConfig(corApp.Application?.plan_type_id, 'COR');
    const fee = feeConfig?.flat_fee || 0;
    return success(res, { cor_fee: fee });
  } catch (err) { next(err); }
};

exports.checkLateFine = async (req, res, next) => {
  try {
    const corApp = await CORApplication.findOne({ where: { reference_number: req.params.ref } });
    if (!corApp) return notFound(res);
    const result = await corWorkflow.checkLateFine(corApp.application_id, req.params.ref);
    return success(res, result);
  } catch (err) { next(err); }
};

exports.linkLateFine = async (req, res, next) => {
  try {
    await CORApplication.update({ late_fine_id: req.body.fine_id }, { where: { cor_application_id: req.params.id } });
    return success(res, null, 'Late fine linked');
  } catch (err) { next(err); }
};

exports.linkPayment = async (req, res, next) => {
  try {
    await CORApplication.update({ payment_id: req.body.payment_id }, { where: { cor_application_id: req.params.id } });
    return success(res, null, 'Payment linked');
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    await CORApplication.update({ status: req.body.status }, { where: { cor_application_id: req.params.id } });
    return success(res, null, 'Status updated');
  } catch (err) { next(err); }
};

exports.scheduleFinalInspection = async (req, res, next) => {
  try {
    const corApp = await CORApplication.findByPk(req.params.id);
    if (!corApp) return notFound(res);
    const originalTO = await corWorkflow.getOriginalTO(corApp.reference_number);
    if (!originalTO) return badRequest(res, 'Could not find original TO for this application');
    await corApp.update({ status: 'INSPECTION_SCHEDULED' });
    return success(res, { cor_application_id: req.params.id, assigned_to: originalTO, status: 'INSPECTION_SCHEDULED' });
  } catch (err) { next(err); }
};

exports.snapshotDeadline = async (req, res, next) => {
  try {
    const corApp = await CORApplication.findByPk(req.params.id, { include: [{ model: Application }] });
    if (!corApp) return notFound(res);
    await corApp.update({ approval_snapshot_expiry: corApp.Application?.approval_expiry_date });
    return success(res, null, 'Deadline snapshotted');
  } catch (err) { next(err); }
};

// GET /cor-applications/ref/:ref/eligibility — frontend alias (ref-based)
exports.checkEligibilityByRef = async (req, res, next) => {
  try {
    const { CORApplication, Application } = require('../models');
    const corApp = await CORApplication.findOne({ where: { reference_number: req.params.ref } });
    if (!corApp) return notFound(res, 'COR application not found');
    const result = await corWorkflow.checkCOREligibility(corApp.application_id);
    await corApp.update({ eligibility_checked_at: new Date() });
    return success(res, result);
  } catch (err) { next(err); }
};
