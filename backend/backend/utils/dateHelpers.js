const addYears = (date, years) => {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const daysUntil = (date) => {
  const now = new Date();
  const target = new Date(date);
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const isExpired = (date) => new Date(date) < new Date();

const monthsUntil = (date) => {
  const now    = new Date();
  const target = new Date(date);
  let months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  // Adjust for day component — e.g. March 1 checked on March 30 should return -1 not 0
  if (now.getDate() > target.getDate()) months -= 1;
  return months;
};

const formatDate = (date) => new Date(date).toLocaleDateString('en-LK');

module.exports = { addYears, addMonths, daysUntil, isExpired, monthsUntil, formatDate };
