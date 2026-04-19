/**
 * Rate Limiter — in-memory store (single-process only)
 *
 * PRODUCTION NOTE: This in-memory store has two limitations:
 *   1. State is lost on process restart — limits reset immediately after crash/deploy
 *   2. Each Node.js process has its own store — PM2 cluster mode or load balancers
 *      allow bypass because requests go to different processes
 *
 * For production with >1 process: replace store with Redis using ioredis:
 *   const redis = require('ioredis'); const client = new redis(process.env.REDIS_URL);
 *   Store reads/writes go through client.get/setex instead of the Map.
 *
 * The current implementation is correct for single-process deployments (PM2 fork mode).
 *
 * Usage:
 *   rateLimiter({ windowMs: 15*60*1000, max: 10, message: 'Too many attempts' })
 */
const { tooManyRequests } = require('../utils/responseHelper');

const store = new Map(); // key → { count, resetAt }

const rateLimiter = ({ windowMs = 15 * 60 * 1000, max = 100, keyFn, message }) => {
  // Prune expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (v.resetAt <= now) store.delete(k);
    }
  }, windowMs);

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      return tooManyRequests(res, message || `Too many requests. Try again later.`);
    }
    next();
  };
};

// Pre-built limiters
rateLimiter.login = rateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 10,
  keyFn: (req) => `login:${req.ip}`,
  message: 'Too many login attempts. Please wait 15 minutes.',
});

rateLimiter.otp = rateLimiter({
  windowMs: 10 * 60 * 1000,  // 10 min
  max: 5,
  keyFn: (req) => `otp:${req.ip}`,
  message: 'Too many OTP requests. Please wait 10 minutes.',
});

rateLimiter.register = rateLimiter({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 20,
  keyFn: (req) => `register:${req.ip}`,
  message: 'Too many registrations from this IP.',
});

rateLimiter.api = rateLimiter({
  windowMs: 60 * 1000,  // 1 min
  max: 120,
  keyFn: (req) => `api:${req.ip}`,
  message: 'Rate limit exceeded.',
});

module.exports = rateLimiter;
