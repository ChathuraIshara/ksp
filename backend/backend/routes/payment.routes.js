const router   = require('express').Router();
const ctrl     = require('../controllers/payment.controller');
const auth     = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

// PayHere IPN webhook — no auth (PayHere calls this directly, signature verified inside)
router.post('/webhook', ctrl.handlePaymentWebhook);

router.use(auth);

// ── DEMO / DEV ONLY: simulate a completed payment without PayHere ─────────────
// Disabled in production. Lets you mark any PENDING payment as COMPLETED
// so you can test the full flow without live PayHere credentials.
// Usage: POST /payments/simulate-completion { reference_number, payment_type }
//
// Bug fixes in this version:
//   1. reference_number may be an application_id (UUID) — resolve to real ref.
//   2. After APPLICATION_FEE completes, create tracking line if none exists.
if (process.env.NODE_ENV !== 'production') {
  router.post('/simulate-completion', allowRoles('APPLICANT','PSO','ADMIN'), async (req, res) => {
    const { Payment, Application, Applicant, User, TrackingLine } = require('../models');
    const applicationSvc  = require('../services/application.service');
    const trackingService = require('../services/trackingLine.service');
    const notifService    = require('../services/notification.service');
    const { v4: uuidv4 }  = require('uuid');

    const isUUID = (str) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    try {
      const { reference_number, payment_type } = req.body;
      if (!reference_number) {
        return res.status(400).json({ success: false, message: 'reference_number required' });
      }

      // ── Resolve application ──────────────────────────────────────────────────
      // reference_number may actually be an application_id (UUID) when the applicant
      // pays before PSO assigns a real reference number.
      let app = null;
      let resolvedRef = reference_number;

      if (isUUID(reference_number)) {
        // Try as application_id first
        app = await Application.findByPk(reference_number);
        if (app) {
          resolvedRef = app.reference_number ?? reference_number;
        }
      }

      if (!app) {
        // Try as reference_number
        app = await Application.findOne({ where: { reference_number: resolvedRef } });
      }

      if (!app) {
        return res.status(404).json({ success: false, message: 'Application not found' });
      }

      // Refresh resolvedRef — app may now have a reference_number even if UUID was passed
      if (app.reference_number) resolvedRef = app.reference_number;

      // ── Find or create PENDING payment ──────────────────────────────────────
      // Search by both reference_number and application_id to cover both cases.
      let payment = await Payment.findOne({
        where: {
          payment_status: 'PENDING',
          payment_type:   payment_type || 'APPLICATION_FEE',
          ...(app.reference_number
            ? { reference_number: app.reference_number }
            : { reference_number: reference_number }
          ),
        },
        order: [['created_at', 'DESC']],
      });

      // Also try by the raw reference_number in case it was stored as UUID
      if (!payment && isUUID(reference_number)) {
        payment = await Payment.findOne({
          where: {
            reference_number: reference_number,
            payment_type:     payment_type || 'APPLICATION_FEE',
            payment_status:   'PENDING',
          },
          order: [['created_at', 'DESC']],
        });
      }

      if (!payment) {
        // Auto-create one if none exists
        payment = await Payment.create({
          reference_number: app.reference_number ?? reference_number,
          application_id:   app.application_id,
          payment_type:     payment_type || 'APPLICATION_FEE',
          amount:           200,
          payment_method:   'ONLINE',
          payment_status:   'PENDING',
          recorded_by:      req.user.user_id,
        });
      }

      const receiptNumber = `DEMO-${Date.now()}`;
      await payment.update({
        payment_status:   'COMPLETED',
        receipt_number:   receiptNumber,
        transaction_id:   `DEMO-TXN-${uuidv4().slice(0,8).toUpperCase()}`,
        paid_at:          new Date(),
        // Ensure reference_number is stored correctly on the payment record
        reference_number: app.reference_number ?? payment.reference_number,
      });

      // ── Auto-advance application status ──────────────────────────────────────
      const PAYMENT_ADVANCE_MAP = {
        APPLICATION_FEE: 'SUBMITTED',
        APPROVAL_FEE:    'CERTIFICATE_READY',
        COR_FEE:         'COR_REVIEW',
        LATE_COR_FEE:    'COR_REVIEW',
      };
      const nextStatus = PAYMENT_ADVANCE_MAP[payment.payment_type];
      if (nextStatus) {
        try {
          await applicationSvc.transition(app.application_id, nextStatus, req.user.user_id);
        } catch (e) {
          // Non-fatal — state machine may reject if already in that status
          console.warn('[SIMULATE] transition non-fatal:', e.message);
        }

        // ── Ensure tracking line exists ───────────────────────────────────────
        // After APPLICATION_FEE, the app transitions to SUBMITTED.
        // If PSO has already assigned a reference_number, create the tracking line now.
        // If not yet assigned, PSO will create it when they call generateReferenceNumber.
        if (payment.payment_type === 'APPLICATION_FEE') {
          try {
            const freshApp = await Application.findByPk(app.application_id);
            const existingLine = await TrackingLine.findOne({
              where: { application_id: app.application_id },
            });
            if (!existingLine && freshApp?.reference_number) {
              await trackingService.createTrackingLine(app.application_id, freshApp.reference_number);
              console.log(`[SIMULATE] Created tracking line for ${freshApp.reference_number}`);
            }
          } catch (tlErr) {
            console.error('[SIMULATE] Tracking line error:', tlErr.message);
          }
        }
      }

      // ── Notify applicant ─────────────────────────────────────────────────────
      const fullApp = await Application.findByPk(app.application_id, {
        include: [{ model: Applicant, include: [{ model: User, attributes: ['user_id'] }] }],
      });
      const uid = fullApp?.Applicant?.User?.user_id;
      if (uid) {
        await notifService.dispatch({
          recipient_id:     uid,
          event_type:       'PAYMENT_CONFIRMED',
          title:            '✅ Payment Confirmed',
          body:             `Your payment for ${payment.payment_type} has been processed.\nReceipt: ${receiptNumber}\n${resolvedRef !== reference_number ? `Reference: ${resolvedRef}` : ''}`,
          reference_number: app.reference_number ?? null,
        }).catch(() => {});
      }

      return res.json({
        success:        true,
        message:        `Payment marked COMPLETED. Receipt: ${receiptNumber}. Application status advanced to: ${nextStatus || 'unchanged'}.`,
        receipt_number: receiptNumber,
        next_status:    nextStatus,
        resolved_ref:   resolvedRef,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });
}

// Applicant / PSO payment flows
router.post('/initiate-payhere',  allowRoles('APPLICANT','PSO','ADMIN'), validate(validate.schemas.initiatePayhere), ctrl.initiatePayhere);
router.post('/online',            allowRoles('APPLICANT','PSO','ADMIN'), validate(validate.schemas.onlinePayment),   ctrl.processOnlinePayment);
router.post('/manual',            allowRoles('PSO','ADMIN'),             validate(validate.schemas.manualPayment),   ctrl.recordManualPayment);
router.post('/verify-online',     allowRoles('APPLICANT','PSO','ADMIN'),                                            ctrl.verifyOnlinePayment);
router.post('/pre-ref-receipt',   allowRoles('PSO','ADMIN'),                                                        ctrl.generatePreRefReceipt);
router.post('/',                  allowRoles('PSO','SW','ADMIN'),        validate(validate.schemas.createPayment),  ctrl.createPayment);

// PSO bank slip verification
router.get('/pending-slips',      allowRoles('PSO','ADMIN'),                                                        ctrl.getPendingSlips);
router.post('/:id/verify-slip',   allowRoles('PSO','ADMIN'),             validate(validate.schemas.verifyBankSlip), ctrl.verifyBankSlip);

// Read endpoints
// Bug fix: APPLICANT added to /ref/:ref so Pay Fees & Fines page can show payment history
router.get('/transaction/:txId',  allowRoles('PSO','SW','ADMIN'),                                    ctrl.getByTransaction);
router.get('/ref/:ref/total',     allowRoles('APPLICANT','PSO','SW','TO','CHAIRMAN','ADMIN'),         ctrl.getTotalPaidByRef);
router.get('/ref/:ref',           allowRoles('APPLICANT','PSO','SW','TO','CHAIRMAN','ADMIN'),         ctrl.getByRef);
router.get('/ref/:ref/type/:type',allowRoles('PSO','SW','ADMIN'),                                    ctrl.getByType);
router.get('/:id/receipt',        ctrl.generateReceipt);
router.put('/:id/status',         allowRoles('PSO','ADMIN'),                                         ctrl.updateStatus);

module.exports = router;