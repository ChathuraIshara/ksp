const { Fine } = require('../models');
const notifEvents = require('../services/notificationEvents.service');
const lockdownService = require('../services/lockdown.service');
const fineService = require('../services/fineCalculator.service');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.createFine = async (req, res, next) => {
  try {
    const body = { ...req.body };
    // Components may send 'amount' instead of 'fine_amount' — normalise
    if (!body.fine_amount && body.amount) body.fine_amount = body.amount;
    if (!body.fine_amount) return badRequest(res, 'fine_amount is required');
    const fine = await Fine.create({ ...body, calculated_by: req.user.user_id });
    await lockdownService.lockRecord(Fine, fine.fine_id);
    return created(res, fine);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try { return success(res, await Fine.findAll({ where: { reference_number: req.params.ref } })); } catch (err) { next(err); }
};

exports.getByStatus = async (req, res, next) => {
  try { return success(res, await Fine.findAll({ where: { payment_status: req.params.status } })); } catch (err) { next(err); }
};

exports.calculateUnauthorizedFine = async (req, res, next) => {
  try {
    const fine = await fineService.calculateUnauthorizedFine(parseFloat(req.body.sqft), req.body.plan_type_id);
    return success(res, { fine });
  } catch (err) { next(err); }
};

exports.calculateLateCORFine = async (req, res, next) => {
  try {
    const fine = await fineService.calculateLateCORFine(parseInt(req.body.days_overdue));
    return success(res, { fine });
  } catch (err) { next(err); }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    await Fine.update({ payment_status: req.body.status, payment_id: req.body.payment_id }, { where: { fine_id: req.params.id } });
    return success(res, null, 'Fine payment status updated');
  } catch (err) { next(err); }
};

exports.waiveFine = async (req, res, next) => {
  try {
    const { reason } = req.body;
    // Government records: fine waivers require a substantive documented reason
    if (!reason || reason.trim().length < 20) {
      return require('../utils/responseHelper').badRequest(res,
        'A waiver reason of at least 20 characters is required. Fine waivers are permanent government records and must be properly justified.'
      );
    }
    await Fine.update({
      payment_status: 'WAIVED',
      waived_by:      req.user.user_id,
      waive_reason:   reason.trim(),
      waived_at:      new Date(),
    }, { where: { fine_id: req.params.id } });
    return success(res, null, 'Fine waived');
  } catch (err) { next(err); }
};

exports.linkPayment = async (req, res, next) => {
  try {
    await Fine.update({ payment_id: req.body.payment_id, payment_status: 'PAID' }, { where: { fine_id: req.params.id } });
    return success(res, null, 'Payment linked');
  } catch (err) { next(err); }
};

exports.notifyAll = async (req, res, next) => {
  try {
    const fine = await Fine.findByPk(req.params.id);
    if (!fine) return notFound(res);
    await notifEvents.emit('FINE_ISSUED', {
      referenceNumber: fine.reference_number,
      applicantId: req.body.applicant_id,
      psoId: req.body.pso_id,
      swId: req.body.sw_id,
    });
    await fine.update({ notified_at: new Date() });
    return success(res, null, 'All parties notified');
  } catch (err) { next(err); }
};

exports.getTotalFinesByRef = async (req, res, next) => {
  try {
    const { sequelize } = require('../models');
    const result = await Fine.findAll({ where: { reference_number: req.params.ref, payment_status: 'PENDING' }, attributes: [[sequelize.fn('SUM', sequelize.col('fine_amount')), 'total']], raw: true });
    return success(res, { total_pending: result[0]?.total || 0 });
  } catch (err) { next(err); }
};
