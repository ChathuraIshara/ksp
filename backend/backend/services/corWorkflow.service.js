const { Application, TaskAssignment, Fine, CORApplication } = require('../models');
const { daysUntil, isExpired } = require('../utils/dateHelpers');
const fineCalculatorService = require('./fineCalculator.service');

const checkCOREligibility = async (applicationId) => {
  const app = await Application.findByPk(applicationId);
  if (!app) return { eligible: false, reason: 'Application not found' };

  if (!['APPROVED','CONDITIONALLY_APPROVED','CERTIFICATE_READY'].includes(app.status)) {
    return { eligible: false, reason: 'Application not in approved state' };
  }

  const isExp = isExpired(app.approval_expiry_date);
  const days = daysUntil(app.approval_expiry_date);

  return { eligible: true, isExpired: isExp, daysRemaining: days, expiryDate: app.approval_expiry_date };
};

const getOriginalTO = async (referenceNumber) => {
  const task = await TaskAssignment.findOne({
    where: { reference_number: referenceNumber, task_type: 'TO_INSPECTION' },
    order: [['created_at', 'ASC']],
  });
  return task?.assigned_to || null;
};

const checkLateFine = async (applicationId, referenceNumber) => {
  const app = await Application.findByPk(applicationId);
  if (!app) return { has_late_fine: false, hasFine: false };

  if (!isExpired(app.approval_expiry_date)) return { has_late_fine: false, hasFine: false };

  const daysOverdue = Math.abs(daysUntil(app.approval_expiry_date));
  const fineAmount = await fineCalculatorService.calculateLateCORFine(daysOverdue);

  // COR fee base (Rs. 3000 default)
  const corFee = 3000;
  return {
    has_late_fine: true,
    hasFine: true,
    daysOverdue,
    fine_amount: fineAmount,
    fineAmount,
    cor_fee: corFee,
    total_amount: corFee + fineAmount,
  };
};

module.exports = { checkCOREligibility, getOriginalTO, checkLateFine };
