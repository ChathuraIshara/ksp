/**
 * PHI (Public Health Inspector) Routes
 * Booklet Pg14: PHI is a mandatory signatory on every inspection and COC.
 */
const router = require('express').Router();
const auth = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');
const { InspectionMinute, FinalInspection } = require('../models');
const { success, notFound, error } = require('../utils/responseHelper');

router.use(auth);
router.use(allowRoles('PHI','ADMIN'));

// GET /phi/pending-inspections — inspection minutes awaiting PHI sign-off
router.get('/pending-inspections', async (req, res) => {
  try {
    const pending = await InspectionMinute.findAll({
      where: { phi_signature_path: null, status: 'SUBMITTED' },
      order: [['submitted_at', 'ASC']],
      limit: 100,
    });
    return success(res, pending);
  } catch (err) { error(res, err.message); }
});

// PUT /phi/inspections/:id/sign — PHI signs off on an inspection minute
router.put('/inspections/:id/sign', async (req, res) => {
  try {
    const { phi_report_notes, phi_septic_tank_distance_ok, phi_sanitation_adequate } = req.body;

    // Validate booleans are actual booleans, not arbitrary injected values
    if (typeof phi_septic_tank_distance_ok !== 'boolean') {
      return res.status(400).json({ success: false, message: 'phi_septic_tank_distance_ok must be true or false' });
    }
    if (typeof phi_sanitation_adequate !== 'boolean') {
      return res.status(400).json({ success: false, message: 'phi_sanitation_adequate must be true or false' });
    }
    if (phi_report_notes !== undefined && phi_report_notes !== null) {
      if (typeof phi_report_notes !== 'string' || phi_report_notes.trim().length < 5) {
        return res.status(400).json({ success: false, message: 'phi_report_notes must be at least 5 characters' });
      }
    }

    const minute = await InspectionMinute.findByPk(req.params.id);
    if (!minute) return notFound(res, 'Inspection minute not found');
    await minute.update({
      // Resolve officer full_name from Officer profile instead of using email
      phi_name: (await require('../models').Officer.findOne({ where: { user_id: req.user.user_id }, attributes: ['full_name'] }))?.full_name || req.user.email,
      phi_report_date: new Date(),
      phi_report_notes: phi_report_notes || null,
      phi_septic_tank_distance_ok,
      phi_sanitation_adequate,
    });
    return success(res, minute, 'PHI sign-off recorded');
  } catch (err) { error(res, err.message); }
});

// GET /phi/pending-cor — final inspections awaiting PHI sanitation check
router.get('/pending-cor', async (req, res) => {
  try {
    const pending = await FinalInspection.findAll({
      where: { status: 'REPORT_SUBMITTED' },
      order: [['report_submitted_at', 'ASC']],
      limit: 100,
    });
    return success(res, pending);
  } catch (err) { error(res, err.message); }
});

// PUT /phi/cor/:id/sign — PHI signs off on a final inspection for COC
router.put('/cor/:id/sign', async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes || typeof notes !== 'string' || notes.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'notes must be at least 5 characters' });
    }
    const fi = await FinalInspection.findByPk(req.params.id);
    if (!fi) return notFound(res, 'Final inspection not found');
    await fi.update({
      report_notes: `${fi.report_notes || ''}\n\nPHI Sign-off (${new Date().toLocaleDateString()}): ${notes.trim()}`,
      status: 'COMPLETED',
    });
    return success(res, fi, 'PHI COR sign-off recorded');
  } catch (err) { error(res, err.message); }
});

module.exports = router;
