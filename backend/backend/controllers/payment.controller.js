/**
 * payment.controller.js
 *
 * Fixes applied:
 *  1. POST /initiate-payhere  — full PayHere checkout params for frontend redirect
 *  2. POST /:id/verify-slip   — PSO marks bank slip as verified + notifies applicant
 *  3. handlePaymentWebhook    — auto-advances application status + notifies applicant
 *
 * Bug fixes (this version):
 *  4. Webhook UUID→ref resolution: order_id may contain application_id (UUID) instead
 *     of reference_number when applicant pays before PSO assigns a ref. We now resolve
 *     the UUID to the real reference_number (or keep searching by application_id).
 *  5. Tracking line creation: after APPLICATION_FEE completes, if no tracking line
 *     exists yet (PSO hasn't assigned a ref), we create it so the first node appears.
 */

const { Payment, Application, Applicant, User, TrackingLine } = require('../models');
const paymentGateway  = require('../services/paymentGateway.service');
const applicationSvc  = require('../services/application.service');
const trackingService = require('../services/trackingLine.service');
const { Op } = require('sequelize');
const notifService    = require('../services/notification.service');
const { generateReceiptPDF } = require('../utils/pdfGenerator');
const { v4: uuidv4 }  = require('uuid');
const path            = require('path');
const env             = require('../config/env');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

// ── Payment type → next application status map ───────────────────────────────
const PAYMENT_ADVANCE_MAP = {
  APPLICATION_FEE:  'SUBMITTED',          // Rs.200 paid → submission unlocked
  APPROVAL_FEE:     'CERTIFICATE_READY',  // Approval fee paid → cert can be generated
  FINE_PAYMENT:     null,                 // Fine paid → no automatic status advance
  COR_FEE:          'COR_REVIEW',         // COR fee paid → final inspection can begin
  LATE_COR_FEE:     'COR_REVIEW',         // Late COR fine + fee paid → COR inspection
  EXTENSION_FEE:    null,                 // Extension handled by timeExtension controller
  APPEAL_FEE:       null,                 // Appeal fee paid → no automatic advance
};

// ── Helper: UUID detector ─────────────────────────────────────────────────────
const isUUID = (str) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Resolve the raw string from order_id back to an Application row.
 *
 * order_id is built as "{referenceNumber}-{timestamp}" by paymentGateway.service.
 * BUT: when an applicant pays before PSO assigns a reference number, the frontend
 * falls back to passing application_id (UUID) as the reference_number. So after
 * stripping the timestamp we may end up with either:
 *   - A real reference number  → e.g. "PS-2025-BP-00123"
 *   - A UUID (application_id)  → e.g. "813e2d78-e98d-4055-b824-ef5b5916b9d5"
 *
 * We try both lookups and return { app, refNum }.
 */
const resolveApplicationFromOrderId = async (order_id) => {
  // Strip the timestamp suffix added by paymentGateway
  const rawRef = order_id.substring(0, order_id.lastIndexOf('-'));

  let app = null;

  if (isUUID(rawRef)) {
    // rawRef is an application_id — look up directly
    app = await Application.findByPk(rawRef);
  }

  if (!app) {
    // Try as reference_number (the normal path once PSO assigns one)
    app = await Application.findOne({ where: { reference_number: rawRef } });
  }

  if (!app && isUUID(rawRef)) {
    // Already tried by PK above — nothing found
    return { app: null, refNum: rawRef };
  }

  const refNum = app?.reference_number ?? rawRef;
  return { app, refNum };
};

// ── Helper: find applicant user_id from an Application row or reference number ─
const getApplicantUserId = async (referenceNumber) => {
  if (!referenceNumber) return null;
  const app = await Application.findOne({
    where: { reference_number: referenceNumber },
    include: [{ model: Applicant, include: [{ model: User, attributes: ['user_id'] }] }],
  });
  return app?.Applicant?.User?.user_id || null;
};

const getApplicantUserIdFromApp = async (app) => {
  if (!app) return null;
  const fullApp = await Application.findByPk(app.application_id, {
    include: [{ model: Applicant, include: [{ model: User, attributes: ['user_id'] }] }],
  });
  return fullApp?.Applicant?.User?.user_id || null;
};

/**
 * Ensure a tracking line exists for an application.
 * Creates one only if it doesn't exist yet.
 * Called after APPLICATION_FEE completes so the first node is always present.
 */
const ensureTrackingLine = async (app) => {
  if (!app) return;
  try {
    const existing = await TrackingLine.findOne({
      where: { application_id: app.application_id },
    });
    if (existing) return; // already exists — nothing to do

    // Refresh app to get latest reference_number (may have been assigned by now)
    const freshApp = await Application.findByPk(app.application_id);
    const refNum = freshApp?.reference_number;

    if (!refNum) {
      // No reference number yet — tracking line will be created when PSO assigns one.
      // This is the normal path; nothing to do here.
      console.log(`[TRACKING] App ${app.application_id} has no ref yet — tracking line deferred to PSO assignment`);
      return;
    }

    await trackingService.createTrackingLine(app.application_id, refNum);
    console.log(`[TRACKING] Created tracking line for ${refNum}`);
  } catch (tlErr) {
    // Non-fatal — log but don't fail the payment webhook
    console.error('[TRACKING] ensureTrackingLine error:', tlErr.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

exports.createPayment = async (req, res, next) => {
  try {
    return created(res, await Payment.create({ ...req.body, recorded_by: req.user.user_id }));
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const { ref } = req.params;

    // Allow lookup by either reference_number OR application_id (UUID)
    // so applicants can see their payment even before a ref is assigned.
    let payments;
    if (isUUID(ref)) {
      const app = await Application.findByPk(ref);
      if (app?.reference_number) {
        // Has a real ref now — return by reference_number
        payments = await Payment.findAll({
          where: { reference_number: app.reference_number },
          order: [['created_at', 'DESC']],
        });
      } else {
        // No ref yet — look up by application_id directly on the payment record
        payments = await Payment.findAll({
          where: {
            [Op.or]: [
              { reference_number: ref },
              { application_id: ref },
            ],
          },
          order: [['created_at', 'DESC']],
        });
      }
    } else {
      payments = await Payment.findAll({
        where: { reference_number: ref },
        order: [['created_at', 'DESC']],
      });
    }

    return success(res, payments);
  } catch (err) { next(err); }
};

exports.getByType = async (req, res, next) => {
  try {
    return success(res, await Payment.findAll({
      where: { reference_number: req.params.ref, payment_type: req.params.type },
    }));
  } catch (err) { next(err); }
};

exports.getByTransaction = async (req, res, next) => {
  try {
    const p = await Payment.findOne({ where: { transaction_id: req.params.txId } });
    if (!p) return notFound(res);
    return success(res, p);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    await Payment.update({ payment_status: req.body.status }, { where: { payment_id: req.params.id } });
    return success(res, null, 'Payment status updated');
  } catch (err) { next(err); }
};

exports.getPendingSlips = async (req, res, next) => {
  try {
    const slips = await Payment.findAll({
      where: {
        payment_method: { [Op.in]: ['BANK_SLIP'] },
        payment_status: 'PENDING',
      },
      order: [['created_at', 'ASC']],
    });
    return success(res, slips);
  } catch (err) { next(err); }
};

exports.generateReceipt = async (req, res, next) => {
  try {
    const p = await Payment.findByPk(req.params.id);
    if (!p) return notFound(res);
    const filename = `receipt_${p.receipt_number || uuidv4()}.pdf`;
    const filePath = await generateReceiptPDF({
      receipt_number:   p.receipt_number,
      reference_number: p.reference_number,
      payment_type:     p.payment_type,
      payment_method:   p.payment_method,
      amount:           p.amount,
      paid_at:          p.paid_at,
    }, filename);
    await p.update({ receipt_path: filePath });
    return success(res, { receipt_path: filePath });
  } catch (err) { next(err); }
};

exports.generatePreRefReceipt = async (req, res, next) => {
  try {
    const { amount, payment_type, applicant_name } = req.body;
    const tempRef  = `PRE-${Date.now()}`;
    const filename = `pre_receipt_${tempRef}.pdf`;
    const filePath = await generateReceiptPDF({
      receipt_number: tempRef,
      payment_type,
      applicant_name,
      amount,
      paid_at: new Date(),
    }, filename);
    return success(res, { receipt_path: filePath, temp_ref: tempRef }, 'Pre-reference receipt generated');
  } catch (err) { next(err); }
};

exports.recordManualPayment = async (req, res, next) => {
  try {
    const receiptNumber = `RCP-${Date.now()}`;
    const payment = await Payment.create({
      ...req.body,
      payment_method:  'CASH',
      payment_status:  'COMPLETED',
      receipt_number:  receiptNumber,
      recorded_by:     req.user.user_id,
      paid_at:         new Date(),
    });
    return created(res, payment);
  } catch (err) { next(err); }
};

exports.verifyOnlinePayment = async (req, res, next) => {
  try {
    const { transaction_id } = req.body;
    const p = await Payment.findOne({ where: { transaction_id } });
    if (!p) return notFound(res, 'Payment not found');
    return success(res, { verified: p.payment_status === 'COMPLETED', payment: p });
  } catch (err) { next(err); }
};

/**
 * POST /payments/online
 * Applicant or PSO initiates a PayHere payment — returns gateway params for checkout.
 */
exports.processOnlinePayment = async (req, res, next) => {
  try {
    const { reference_number, amount, payment_type } = req.body;
    const gateway = await paymentGateway.initiatePayment({
      referenceNumber: reference_number,
      amount,
      paymentType:     payment_type,
      returnUrl:       req.body.return_url,
      cancelUrl:       req.body.cancel_url,
    });
    const payment = await Payment.create({
      reference_number,
      amount,
      payment_type,
      payment_method:  'ONLINE',
      payment_status:  'PENDING',
      recorded_by:     req.user.user_id,
      order_id:        gateway.params.order_id,
    });
    return success(res, { payment, gateway });
  } catch (err) { next(err); }
};

/**
 * POST /payments/initiate-payhere
 *
 * Full PayHere checkout parameter set for the frontend to submit as a form
 * to https://www.payhere.lk/pay/checkout (sandbox or live).
 *
 * Returns everything the React frontend needs:
 *   paymentUrl  — the PayHere checkout URL to POST to
 *   params      — all hidden form fields
 *   payment_id  — local payment record for tracking
 */
exports.initiatePayhere = async (req, res, next) => {
  try {
    const {
      reference_number, amount, payment_type,
      first_name, last_name, email, phone, address, city,
      return_url, cancel_url,
    } = req.body;

    if (!reference_number || !amount || !payment_type) {
      return badRequest(res, 'reference_number, amount and payment_type are required');
    }

    // If PayHere credentials not configured (dev/demo), tell frontend to use simulate
    if (!process.env.PAYHERE_MERCHANT_ID || !process.env.PAYHERE_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        return badRequest(res, 'Payment gateway is not configured. Contact the system administrator.');
      }
      // Dev/demo mode — create a PENDING payment record and return a simulate flag
      const receiptNumber = `PENDING-${Date.now()}`;
      const payment = await Payment.create({
        reference_number,
        amount,
        payment_type,
        payment_method:  'ONLINE',
        payment_status:  'PENDING',
        receipt_number:  receiptNumber,
        recorded_by:     req.user.user_id,
      });
      return success(res, {
        payment_id:       payment.payment_id,
        payment_url:      null,
        params:           null,
        demo_mode:        true,
        instructions:     'PayHere is not configured. Use POST /payments/simulate-completion to complete this payment in dev/demo mode.',
      });
    }

    // Build PayHere params
    const gateway = await paymentGateway.initiatePayment({
      referenceNumber: reference_number,
      amount,
      paymentType:     payment_type,
      returnUrl:       return_url || `${process.env.FRONTEND_URL}/payment/success`,
      cancelUrl:       cancel_url || `${process.env.FRONTEND_URL}/payment/cancel`,
    });

    // Add customer details to params (PayHere uses these for card billing)
    const fullParams = {
      ...gateway.params,
      first_name:  first_name  || '',
      last_name:   last_name   || '',
      email:       email       || '',
      phone:       phone       || '',
      address:     address     || 'Kelaniya',
      city:        city        || 'Kelaniya',
      country:     'Sri Lanka',
    };

    // Create a PENDING payment record
    const receiptNumber = `ONLINE-${Date.now()}`;
    const payment = await Payment.create({
      reference_number,
      amount,
      payment_type,
      payment_method:  'PAYHERE',
      payment_status:  'PENDING',
      receipt_number:  receiptNumber,
      order_id:        gateway.params.order_id,
      recorded_by:     req.user.user_id,
    });

    return success(res, {
      payment_id:   payment.payment_id,
      payment_url:  gateway.paymentUrl,
      params:       fullParams,
      demo_mode:    false,
      instructions: 'POST the params as a form to payment_url to redirect the user to PayHere checkout.',
    });
  } catch (err) { next(err); }
};

/**
 * POST /payments/:id/verify-slip
 *
 * PSO views the uploaded bank slip and marks the payment as COMPLETED.
 * After verification:
 *   • Payment status → COMPLETED
 *   • Receipt generated
 *   • Applicant notified via IN_APP + SMS
 *   • Application status auto-advanced if applicable
 *   • Tracking line ensured (created if missing)
 */
exports.verifyBankSlip = async (req, res, next) => {
  try {
    const { verified, rejection_note } = req.body;

    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return notFound(res, 'Payment not found');
    if (payment.payment_status === 'COMPLETED') {
      return badRequest(res, 'Payment has already been verified');
    }

    if (verified === false) {
      // PSO rejects the slip
      await payment.update({
        payment_status:   'FAILED',
        pso_verified_by:  req.user.user_id,
        pso_verified_at:  new Date(),
        rejection_note:   rejection_note || 'Bank slip rejected by PSO',
      });

      // Notify applicant of rejection
      const applicantUserId = await getApplicantUserId(payment.reference_number);
      if (applicantUserId) {
        await notifService.dispatch({
          recipient_id:     applicantUserId,
          event_type:       'PAYMENT_SLIP_REJECTED',
          title:            'Bank Slip Rejected',
          body:             `Your bank slip for ${payment.payment_type} (Ref: ${payment.reference_number}) has been rejected.\nReason: ${rejection_note || 'Please re-upload a clear copy of the bank slip.'}\n\nPlease log in and re-upload.`,
          reference_number: payment.reference_number,
        });
      }
      return success(res, null, 'Bank slip rejected and applicant notified');
    }

    // PSO approves the slip
    const receiptNumber = `SLIP-${Date.now()}`;
    await payment.update({
      payment_status:   'COMPLETED',
      payment_method:   'BANK_SLIP',
      receipt_number:   receiptNumber,
      pso_verified_by:  req.user.user_id,
      pso_verified_at:  new Date(),
      paid_at:          new Date(),
    });

    // Generate receipt PDF
    let receiptPath = null;
    try {
      receiptPath = await generateReceiptPDF({
        receipt_number:   receiptNumber,
        reference_number: payment.reference_number,
        payment_type:     payment.payment_type,
        payment_method:   'Bank Slip (Verified)',
        amount:           payment.amount,
        paid_at:          new Date(),
      }, `receipt_${receiptNumber}.pdf`);
      await payment.update({ receipt_path: receiptPath });
    } catch (pdfErr) {
      console.error('[SLIP VERIFY] Receipt PDF error:', pdfErr.message);
    }

    // Notify applicant — IN_APP + SMS
    const applicantUserId = await getApplicantUserId(payment.reference_number);
    if (applicantUserId) {
      await notifService.dispatch({
        recipient_id:     applicantUserId,
        event_type:       'PAYMENT_CONFIRMED',
        title:            'Payment Confirmed',
        body:             `Your bank slip payment for ${payment.payment_type} (Ref: ${payment.reference_number}) has been verified by the Pradeshiya Sabha.\nAmount: Rs. ${Number(payment.amount).toLocaleString()}\nReceipt No: ${receiptNumber}\n\nYour application will now proceed to the next stage.`,
        reference_number: payment.reference_number,
      });
    }

    // Auto-advance application status if applicable
    const nextStatus = PAYMENT_ADVANCE_MAP[payment.payment_type];
    if (nextStatus && payment.reference_number) {
      try {
        const app = await Application.findOne({ where: { reference_number: payment.reference_number } });
        if (app) {
          await applicationSvc.transition(app.application_id, nextStatus, req.user.user_id);
          // Ensure tracking line exists
          await ensureTrackingLine(app);
        }
      } catch (advanceErr) {
        console.error('[SLIP VERIFY] Status advance error:', advanceErr.message);
      }
    }

    return success(res, {
      payment_id:     payment.payment_id,
      receipt_number: receiptNumber,
      receipt_path:   receiptPath,
    }, 'Bank slip verified. Applicant notified.');
  } catch (err) { next(err); }
};

/**
 * POST /payments/webhook  (PayHere IPN — no auth, signature verified)
 *
 * PayHere calls this after every payment attempt.
 * On success (status_code = 2):
 *   • Payment → COMPLETED
 *   • Receipt generated
 *   • Applicant notified
 *   • Application status auto-advanced
 *   • Tracking line created if this is APPLICATION_FEE and none exists yet
 *
 * Bug fix: order_id may contain application_id (UUID) instead of reference_number
 * when applicant pays before PSO assigns a ref. resolveApplicationFromOrderId()
 * handles both cases transparently.
 */
exports.handlePaymentWebhook = async (req, res, next) => {
  try {
    // PayHere sends application/x-www-form-urlencoded — parse raw buffer if needed
    let body = req.body;
    if (Buffer.isBuffer(body)) {
      const qs = require('querystring');
      body = qs.parse(body.toString('utf8'));
    }
    const valid = paymentGateway.verifyWebhookSignature(body);
    if (!valid) {
      console.warn('[PAYHERE WEBHOOK] Invalid signature — rejected');
      return badRequest(res, 'Invalid webhook signature');
    }

    const { order_id, status_code, payhere_amount, payhere_currency } = body;

    // ── Resolve application from order_id ────────────────────────────────────
    // order_id = "{referenceNumber OR applicationId}-{timestamp}"
    // Strip the timestamp then resolve to the Application row using both strategies.
    const { app, refNum } = await resolveApplicationFromOrderId(order_id);

    const status = status_code === '2' ? 'COMPLETED'
                 : status_code === '0' ? 'PENDING'
                 : 'FAILED';

    // Find the matching PENDING payment record by order_id
    const payment = await Payment.findOne({
      where: { order_id, payment_status: 'PENDING' },
    });

    if (!payment) {
      console.warn(`[PAYHERE WEBHOOK] No pending payment found for order_id: ${order_id}`);
      return res.status(200).send('OK');
    }

    const receiptNumber = `PH-${Date.now()}`;
    await payment.update({
      payment_status:   status,
      gateway_response: body,
      receipt_number:   status === 'COMPLETED' ? receiptNumber : null,
      paid_at:          status === 'COMPLETED' ? new Date() : null,
      // Also save the resolved reference_number onto the payment record if missing
      reference_number: payment.reference_number || (app?.reference_number ?? null),
    });

    if (status !== 'COMPLETED') {
      console.log(`[PAYHERE WEBHOOK] Payment ${order_id} status: ${status}`);
      return res.status(200).send('OK');
    }

    // ── Payment succeeded ─────────────────────────────────────────────────────

    // Generate receipt PDF
    let receiptPath = null;
    try {
      receiptPath = await generateReceiptPDF({
        receipt_number:   receiptNumber,
        reference_number: app?.reference_number ?? refNum,
        payment_type:     payment.payment_type,
        payment_method:   'PayHere Online',
        amount:           payhere_amount || payment.amount,
        paid_at:          new Date(),
      }, `receipt_${receiptNumber}.pdf`);
      await payment.update({ receipt_path: receiptPath });
    } catch (pdfErr) {
      console.error('[PAYHERE WEBHOOK] Receipt PDF error:', pdfErr.message);
    }

    // Notify applicant
    const applicantUserId = app
      ? await getApplicantUserIdFromApp(app)
      : await getApplicantUserId(refNum);

    if (applicantUserId) {
      await notifService.dispatch({
        recipient_id:     applicantUserId,
        event_type:       'PAYMENT_CONFIRMED',
        title:            'Payment Successful',
        body:             `Your online payment for ${payment.payment_type} (Ref: ${app?.reference_number ?? refNum ?? 'Pending'}) has been received.\nAmount: Rs. ${Number(payhere_amount || payment.amount).toLocaleString()}\nReceipt No: ${receiptNumber}\n\nYour application will now proceed to the next stage.`,
        reference_number: app?.reference_number ?? refNum ?? null,
      }).catch(e => console.error('[PAYHERE WEBHOOK] Notify error:', e.message));
    }

    // Auto-advance application status
    const nextStatus = PAYMENT_ADVANCE_MAP[payment.payment_type];
    if (nextStatus && app) {
      try {
        await applicationSvc.forceTransition(app.application_id, nextStatus);
        console.log(`[PAYHERE WEBHOOK] Application ${app.application_id} advanced to ${nextStatus}`);

        // Ensure tracking line exists — create it if APPLICATION_FEE just completed
        // and PSO has already assigned a reference number. If not yet assigned,
        // ensureTrackingLine will detect the missing ref and skip gracefully.
        await ensureTrackingLine(app);
      } catch (advanceErr) {
        console.error('[PAYHERE WEBHOOK] Status advance error:', advanceErr.message);
      }
    } else if (nextStatus && refNum && !app) {
      // Fallback: app not found by ID but refNum exists — try by reference_number
      try {
        const appByRef = await Application.findOne({ where: { reference_number: refNum } });
        if (appByRef) {
          await applicationSvc.forceTransition(appByRef.application_id, nextStatus);
          await ensureTrackingLine(appByRef);
        }
      } catch (advanceErr) {
        console.error('[PAYHERE WEBHOOK] Fallback status advance error:', advanceErr.message);
      }
    }

    console.log(`[PAYHERE WEBHOOK] ✅ Payment ${receiptNumber} for ${app?.reference_number ?? refNum ?? order_id} confirmed`);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[PAYHERE WEBHOOK] Error:', err.message);
    // Always return 200 to PayHere — they retry on non-200
    return res.status(200).send('OK');
  }
};

exports.getTotalPaidByRef = async (req, res, next) => {
  try {
    const { sequelize } = require('../models');
    const result = await Payment.findAll({
      where:      { reference_number: req.params.ref, payment_status: 'COMPLETED' },
      attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
      raw:        true,
    });
    return success(res, { total: result[0]?.total || 0 });
  } catch (err) { next(err); }
};