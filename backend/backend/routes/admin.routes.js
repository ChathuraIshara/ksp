const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/admin.controller');
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');

router.use(auth);
router.use(allowRoles('ADMIN'));

// Dashboard & stats
router.get('/users',                              ctrl.listAllOfficers);
router.get('/dashboard',                          ctrl.getDashboardStats);
router.get('/application-stats',                  ctrl.getSystemApplicationStats);
router.get('/system-health',                      ctrl.getSystemHealthCheck);

// UC03 — Officer account management
router.get('/pending-verifications',              ctrl.listPendingOfficerVerifications);
router.put('/users/:userId/approve',              ctrl.approveOfficer);
router.put('/users/:userId/reject',               ctrl.rejectOfficer);
router.put('/users/:userId/role',                 validate(validate.schemas.updateUserRole), ctrl.updateUserRole);
router.put('/users/:userId/activate',       ctrl.activateUser);
router.put('/users/:userId/suspend',              ctrl.suspendUser);

// UC03 — Create officer account (sets PENDING_VERIFICATION — must approve after)
router.post('/users/create',         ctrl.createOfficer);
// UC03 — Edit officer email / password / profile
router.put('/users/:userId/edit',           ctrl.editOfficer);
// UC03 — Admin-to-Admin mutual recovery (only another Admin can reset a locked-out Admin/Officer)
router.put('/users/:userId/reset-password', ctrl.adminResetPassword);

// Application overrides
router.put('/applications/:ref/override-status',  validate(validate.schemas.overrideStatus), ctrl.overrideApplicationStatus);
router.post('/tax-records/trigger-import',        ctrl.triggerBulkTaxImport);

// ── Reports ───────────────────────────────────────────────────────────────────
router.get('/reports/generate',                   ctrl.generateReport);
router.get('/reports/processing-time',            ctrl.getProcessingTimeReport);

// ── Frontend alias routes ─────────────────────────────────────────────────────
router.get('/dashboard-stats',              ctrl.getDashboardStats);          // FE alias
router.get('/reports',                      ctrl.generateReport);             // FE: GET /admin/reports
router.post('/officers',                    ctrl.createOfficer);              // FE: POST /admin/officers
router.get('/health',                       ctrl.getSystemHealthCheck);       // FE: GET /admin/health

module.exports = router;
