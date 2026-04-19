const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { unauthorized } = require('../utils/responseHelper');
const { hashToken } = require('../services/auth.service');

module.exports = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return unauthorized(res, 'Refresh token required');
  try {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + '_refresh');
    const decoded = jwt.verify(refreshToken, refreshSecret);
    const user = await User.findByPk(decoded.user_id);
    // Compare stored hash against hash of the presented token
    if (!user || user.refresh_token !== hashToken(refreshToken)) return unauthorized(res, 'Invalid refresh token');
    req.user = decoded;
    req.dbUser = user;
    next();
  } catch (err) {
    return unauthorized(res, 'Refresh token expired or invalid');
  }
};
