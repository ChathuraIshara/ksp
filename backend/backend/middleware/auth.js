const jwt  = require('jsonwebtoken');
const env  = require('../config/env');
const { unauthorized } = require('../utils/responseHelper');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'No token provided');
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || env.jwt.secret);
    req.user = decoded;

    // Verify token against DB — rejects tokens after logout or password change
    const { User } = require('../models');
    const dbUser = await User.findByPk(decoded.user_id, {
      attributes: ['jwt_token', 'isBlocked', 'status'],
    });
    if (!dbUser) return unauthorized(res, 'User not found');
    if (dbUser.isBlocked) return unauthorized(res, 'Account is blocked');
    if (dbUser.status === 'SUSPENDED') return unauthorized(res, 'Account is suspended');
    if (!dbUser.jwt_token || dbUser.jwt_token !== token) {
      return unauthorized(res, 'Session expired. Please log in again.');
    }

    next();
  } catch (err) {
    return unauthorized(res, 'Invalid or expired token');
  }
};
