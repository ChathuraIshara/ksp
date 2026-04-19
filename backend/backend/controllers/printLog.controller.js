const { CertificatePrintLog } = require('../models');
const printControlService = require('../services/printControl.service');
const notifService = require('../services/notification.service');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.getByContent = async (req, res, next) => {
  try {
    const logs = await CertificatePrintLog.findAll({
      where: { certificate_id: req.params.certificateId },
      order: [['printed_at', 'DESC']],
    });
    return success(res, logs);
  } catch (err) { next(err); }
};

exports.getLatestPrintNumber = async (req, res, next) => {
  try {
    const num = await printControlService.getNextPrintNumber(req.params.certificateId);
    return success(res, { next_print_number: num, previous_print_count: num - 1 });
  } catch (err) { next(err); }
};

exports.validatePrintPermission = async (req, res, next) => {
  try {
    const { certificate_id } = req.body;
    const isFirst = await printControlService.isFirstPrint(certificate_id);
    return success(res, {
      can_print: true,
      is_first_print: isFirst,
      requires_reason: !isFirst,
      requires_chairman_notification: !isFirst,
    });
  } catch (err) { next(err); }
};

exports.updateReason = async (req, res, next) => {
  try {
    const log = await CertificatePrintLog.findByPk(req.params.id);
    if (!log) return notFound(res);
    await log.update({ reason: req.body.reason });
    return success(res, null, 'Reason updated');
  } catch (err) { next(err); }
};

exports.notifyChairmanOnReprint = async (req, res, next) => {
  try {
    const log = await CertificatePrintLog.findByPk(req.params.id);
    if (!log) return notFound(res);
    if (log.print_number <= 1) return success(res, null, 'First print — no chairman notification needed');
    await notifService.dispatch({
      recipient_id: req.body.chairman_id,
      event_type: 'REPRINT_NOTIFICATION',
      title: 'Certificate Reprint Alert',
      body: `Print #${log.print_number} on certificate ${log.reference_number}. Reason: ${log.reason || 'Not provided'}`,
      channel: 'IN_APP',
      reference_number: log.reference_number,
    });
    await log.update({ chairman_notified: true, chairman_notified_at: new Date() });
    return success(res, null, 'Chairman notified');
  } catch (err) { next(err); }
};

exports.isFirstPrint = async (req, res, next) => {
  try {
    const isFirst = await printControlService.isFirstPrint(req.params.id);
    return success(res, { is_first_print: isFirst });
  } catch (err) { next(err); }
};
