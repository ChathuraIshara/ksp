const { forbidden } = require('../utils/responseHelper');

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user) return forbidden(res, 'No user context');
  if (!roles.includes(req.user.role)) {
    return forbidden(res, `Access denied. Required roles: ${roles.join(', ')}`);
  }
  next();
};

module.exports = { allowRoles };
