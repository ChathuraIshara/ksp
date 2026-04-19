const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

const hashPassword = async (password) => bcrypt.hash(password, 12);
const comparePassword = async (plain, hash) => bcrypt.compare(plain, hash);

const generateAccessToken = (payload) =>
  jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });

const generateOTP = () => {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, expiresAt };
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const verifyToken = (plain, stored) =>
  hashToken(plain) === stored;

const verifyOTP = (storedCode, storedExpiry, inputCode) => {
  if (!storedCode || !storedExpiry) return false;
  if (new Date() > new Date(storedExpiry)) return false;
  // Use timing-safe comparison to prevent timing-based enumeration attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(storedCode).padEnd(10)),
      Buffer.from(String(inputCode).padEnd(10)),
    );
  } catch {
    return false;
  }
};

module.exports = { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, generateOTP, verifyOTP, hashToken, verifyToken };
