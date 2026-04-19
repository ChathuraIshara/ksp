const { Application } = require('../models');
const { Op } = require('sequelize');
const { monthsUntil, isExpired } = require('../utils/dateHelpers');

const updateExpiryFlags = async () => {
  const apps = await Application.findAll({
    where: {
      approval_expiry_date: { [Op.ne]: null },
      status: { [Op.notIn]: ['CLOSED', 'EXPIRED', 'COR_ISSUED'] },
    },
  });
  for (const app of apps) {
    if (isExpired(app.approval_expiry_date)) {
      if (app.status !== 'EXPIRED') await app.update({ status: 'EXPIRED' });
    }
  }
};

const getAppsForReminder = async (monthsBefore, flagField) => {
  const apps = await Application.findAll({
    where: {
      approval_expiry_date: { [Op.ne]: null },
      [flagField]: false,
      status: { [Op.notIn]: ['CLOSED', 'EXPIRED', 'COR_ISSUED'] },
    },
  });
  return apps.filter(a => {
    const m = monthsUntil(a.approval_expiry_date);
    return m <= monthsBefore && m > (monthsBefore - 1);
  });
};

const extendDeadline = async (applicationId, extensionYears = 1) => {
  const app = await Application.findByPk(applicationId);
  if (!app) throw new Error('Application not found');
  const current  = app.approval_expiry_date ? new Date(app.approval_expiry_date) : new Date();
  const newExpiry = new Date(current);
  newExpiry.setFullYear(newExpiry.getFullYear() + extensionYears);
  await app.update({ approval_expiry_date: newExpiry });
  return newExpiry;
};

// Single module.exports ← fixed
module.exports = { updateExpiryFlags, getAppsForReminder, extendDeadline };
