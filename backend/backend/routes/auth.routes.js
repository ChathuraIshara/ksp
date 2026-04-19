const router      = require('express').Router();
const ctrl        = require('../controllers/auth.controller');
const auth        = require('../middleware/auth');
const rateLimiter    = require('../middleware/rateLimiter');
const validate       = require('../middleware/validate');
const refreshToken   = require('../middleware/refreshToken');

// Public
router.post('/register',        rateLimiter.register, validate(validate.schemas.register), ctrl.register);
router.post('/login',           rateLimiter.login,    validate(validate.schemas.login),    ctrl.login);
router.post('/google',          rateLimiter.login,    ctrl.googleAuth);
router.post('/forgot-password', rateLimiter.otp,      ctrl.forgotPassword);
router.post('/reset-password',  rateLimiter.otp,      ctrl.resetPassword);

// Token refresh — no auth middleware, uses its own refreshToken middleware
router.post('/refresh',         rateLimiter.login, refreshToken, ctrl.refreshToken);

// Authenticated
router.get('/me',               auth, ctrl.me);
router.post('/logout',          auth, ctrl.logout);
router.post('/send-otp',        auth, rateLimiter.otp, ctrl.sendOTP);     // email verification
router.post('/verify-otp',      auth, rateLimiter.otp, ctrl.verifyOTP);   // email verification
router.post('/generate-otp',    auth, rateLimiter.otp, ctrl.generateOTP); // chairman signing only

module.exports = router;
