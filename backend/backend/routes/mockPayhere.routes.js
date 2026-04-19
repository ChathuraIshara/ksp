/**
 * mockPayhere.routes.js
 *
 * LOCAL DEMO ONLY — mounted at /mock-payhere when NODE_ENV !== 'production'
 *
 * Replaces the real PayHere checkout page during development and demo.
 * Behaviour is identical to real PayHere from the system's perspective:
 *
 *  1. Frontend POSTs the same params it would send to sandbox.payhere.lk
 *  2. This router renders a realistic-looking checkout page showing:
 *       - Merchant name, order ID, amount
 *       - A card form (purely visual — no real card processing)
 *       - Two buttons: "Pay Now" and "Cancel"
 *  3. On "Pay Now":
 *       - Server computes the correct MD5 IPN signature
 *       - Server POSTs the IPN payload to /api/v1/payments/webhook (same server)
 *       - Page redirects to return_url with ?status=success
 *  4. On "Cancel":
 *       - Page redirects to cancel_url
 *
 * This means:
 *   ✅ Payment record saved to DB as COMPLETED (same as real PayHere)
 *   ✅ Application status auto-advanced
 *   ✅ Applicant notified
 *   ✅ Receipt generated
 *   ✅ The full flow is demonstrable end-to-end without real credentials
 */

const router  = require('express').Router();
const crypto  = require('crypto');
const axios   = require('axios');
const qs      = require('querystring');

// ── Helpers ───────────────────────────────────────────────────────────────────

const merchantSecret = () => process.env.PAYHERE_SECRET || 'MTIyNzE0OVN0b3JlU2VjcmV0';
const merchantId     = () => process.env.PAYHERE_MERCHANT_ID || '1227149';
const webhookUrl     = () => `${process.env.APP_URL || 'http://localhost:5000'}/api/v1/payments/webhook`;

// Compute the PayHere IPN md5sig:
// MD5( merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(secret).toUpperCase() ).toUpperCase()
const computeIpnSig = (orderId, amount, statusCode) => {
  const secretHash = crypto.createHash('md5').update(merchantSecret()).digest('hex').toUpperCase();
  return crypto.createHash('md5')
    .update(`${merchantId()}${orderId}${Number(amount).toFixed(2)}LKR${statusCode}${secretHash}`)
    .digest('hex').toUpperCase();
};

// ── GET /mock-payhere/checkout  (form POST lands here) ────────────────────────
// PayHere checkout is actually a POST, not a GET.
// The frontend submits a form to PAYHERE_URL, which is this endpoint.
router.post('/checkout', (req, res) => {
  const {
    merchant_id, order_id, items, currency, amount,
    return_url, cancel_url, notify_url,
    first_name, last_name, email, phone,
  } = req.body;

  if (!order_id || !amount) {
    return res.status(400).send('<h2>Invalid payment request — missing order_id or amount</h2>');
  }

  // Render the mock checkout page
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PayHere — Secure Checkout (Demo)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4f8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      width: 100%;
      max-width: 440px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1b3fa0, #2d5be3);
      padding: 1.5rem;
      color: white;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .header-logo {
      background: white;
      border-radius: 8px;
      padding: 6px 10px;
      font-weight: 900;
      font-size: 14px;
      color: #1b3fa0;
      letter-spacing: -0.5px;
    }
    .header-info { flex: 1; }
    .header-info h2 { font-size: 16px; font-weight: 600; }
    .header-info p  { font-size: 13px; opacity: 0.85; margin-top: 2px; }
    .demo-banner {
      background: #fef3c7;
      border-bottom: 1px solid #fde68a;
      padding: 8px 16px;
      font-size: 12px;
      color: #92400e;
      text-align: center;
      font-weight: 500;
    }
    .order-box {
      background: #f8fafc;
      border-bottom: 1px solid #e8ecf0;
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .order-box .label { font-size: 12px; color: #64748b; }
    .order-box .ref   { font-size: 13px; font-weight: 600; color: #1e293b; font-family: monospace; }
    .order-box .amount{ font-size: 22px; font-weight: 800; color: #1b3fa0; }
    .order-box .curr  { font-size: 13px; color: #64748b; }
    .form-body { padding: 1.5rem; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    .field { margin-bottom: 1rem; }
    .field label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    .field input {
      width: 100%; padding: 10px 12px;
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 15px; color: #1e293b;
      background: #f8fafc;
      outline: none; transition: border-color 0.15s;
    }
    .field input:focus { border-color: #2d5be3; background: white; }
    .field input.mock-filled { background: #eff6ff; border-color: #bfdbfe; color: #1e3a8a; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .card-icon { position: relative; }
    .card-icon input { padding-right: 44px; }
    .card-icon::after {
      content: '💳';
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      font-size: 18px; pointer-events: none;
    }
    .btns { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.5rem; }
    .btn-pay {
      padding: 14px;
      background: linear-gradient(135deg, #1b3fa0, #2d5be3);
      color: white; border: none; border-radius: 10px;
      font-size: 15px; font-weight: 700; cursor: pointer;
      transition: opacity 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-pay:hover { opacity: 0.9; }
    .btn-pay:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-cancel {
      padding: 10px;
      background: transparent; color: #94a3b8;
      border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 13px; cursor: pointer; transition: all 0.15s;
    }
    .btn-cancel:hover { border-color: #94a3b8; color: #64748b; }
    .secure-note {
      text-align: center; font-size: 11px; color: #94a3b8;
      margin-top: 1rem; display: flex; align-items: center; justify-content: center; gap: 4px;
    }
    .processing {
      display: none;
      text-align: center; padding: 2rem;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #2d5be3;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-icon { font-size: 48px; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="header-logo">Pay<span style="color:#60a5fa">Here</span></div>
    <div class="header-info">
      <h2>Secure Payment</h2>
      <p>Kelaniya Pradeshiya Sabha</p>
    </div>
  </div>
  <div class="demo-banner">
    🔧 Demo Mode — No real card processing. Click "Pay Now" to simulate a successful payment.
  </div>
  <div class="order-box">
    <div>
      <div class="label">Order Reference</div>
      <div class="ref">${order_id}</div>
      <div class="label" style="margin-top:4px">${(items || 'APPLICATION_FEE').replace(/_/g,' ')}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Amount Due</div>
      <div class="amount">Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</div>
      <div class="curr">LKR • Sri Lanka</div>
    </div>
  </div>

  <div class="form-body" id="payForm">
    <div class="section-title">Card Details</div>
    <div class="field card-icon">
      <label>Card Number</label>
      <input type="text" class="mock-filled" value="4111 1111 1111 1111" readonly />
    </div>
    <div class="row">
      <div class="field">
        <label>Expiry Date</label>
        <input type="text" class="mock-filled" value="12/28" readonly />
      </div>
      <div class="field">
        <label>CVV</label>
        <input type="text" class="mock-filled" value="123" readonly />
      </div>
    </div>
    <div class="section-title" style="margin-top:0.5rem">Cardholder Details</div>
    <div class="field">
      <label>Name on Card</label>
      <input type="text" class="mock-filled" value="${first_name || ''} ${last_name || ''}".trim() readonly />
    </div>
    <div class="field">
      <label>Email</label>
      <input type="text" class="mock-filled" value="${email || ''}" readonly />
    </div>
    <div class="btns">
      <button class="btn-pay" id="payBtn" onclick="doPayment()">
        🔒 Pay Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
      </button>
      <button class="btn-cancel" onclick="doCancel()">Cancel Payment</button>
    </div>
    <div class="secure-note">🔒 256-bit SSL encryption &nbsp;|&nbsp; PCI DSS Compliant</div>
  </div>

  <div class="processing" id="processing">
    <div class="spinner"></div>
    <p style="color:#1e293b;font-weight:600">Processing your payment...</p>
    <p style="color:#64748b;font-size:13px;margin-top:4px">Please do not close this window</p>
  </div>
</div>

<script>
  const ORDER_ID    = ${JSON.stringify(order_id)};
  const AMOUNT      = ${JSON.stringify(amount)};
  const RETURN_URL  = ${JSON.stringify(return_url || 'http://localhost:3000/app/dashboard')};
  const CANCEL_URL  = ${JSON.stringify(cancel_url || 'http://localhost:3000/app/dashboard')};

  async function doPayment() {
    document.getElementById('payBtn').disabled = true;
    document.getElementById('payForm').style.display = 'none';
    document.getElementById('processing').style.display = 'block';

    try {
      // Ask the backend to fire the IPN webhook and complete the payment
      const resp = await fetch('/mock-payhere/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: ORDER_ID, amount: AMOUNT, return_url: RETURN_URL }),
      });
      const data = await resp.json();

      if (data.success) {
        document.getElementById('processing').innerHTML =
          '<div class="success-icon">✅</div>' +
          '<p style="color:#166534;font-weight:700;font-size:18px">Payment Successful!</p>' +
          '<p style="color:#64748b;font-size:13px;margin-top:6px">Receipt: ' + data.receipt_number + '</p>' +
          '<p style="color:#64748b;font-size:12px;margin-top:4px">Redirecting back to the application...</p>';
        setTimeout(() => { window.location.href = RETURN_URL + '?status=success&order_id=' + ORDER_ID; }, 2000);
      } else {
        document.getElementById('processing').innerHTML =
          '<div style="font-size:40px">❌</div>' +
          '<p style="color:#991b1b;font-weight:700">Payment Failed</p>' +
          '<p style="color:#64748b;font-size:13px;margin-top:6px">' + (data.message || 'Unknown error') + '</p>' +
          '<button class="btn-cancel" style="margin-top:1rem" onclick="location.reload()">Try Again</button>';
      }
    } catch (err) {
      document.getElementById('processing').innerHTML =
        '<div style="font-size:40px">⚠️</div>' +
        '<p style="color:#92400e;font-weight:700">Connection Error</p>' +
        '<p style="color:#64748b;font-size:13px;margin-top:6px">' + err.message + '</p>' +
        '<button class="btn-cancel" style="margin-top:1rem" onclick="location.reload()">Try Again</button>';
    }
  }

  function doCancel() {
    window.location.href = CANCEL_URL + '?status=cancelled&order_id=' + ORDER_ID;
  }
</script>
</body>
</html>`);
});

// ── POST /mock-payhere/process  (AJAX call from mock checkout page) ────────────
// Computes the correct IPN signature and POSTs it to the real webhook handler.
router.post('/process', async (req, res) => {
  const { order_id, amount, return_url } = req.body;

  if (!order_id || !amount) {
    return res.json({ success: false, message: 'Missing order_id or amount' });
  }

  try {
    const payhereAmount = Number(amount).toFixed(2);
    const statusCode    = '2'; // PayHere success
    const md5sig        = computeIpnSig(order_id, amount, statusCode);

    const ipnPayload = {
      merchant_id:      merchantId(),
      order_id,
      payment_id:       `MOCK-${Date.now()}`,
      payhere_amount:   payhereAmount,
      payhere_currency: 'LKR',
      status_code:      statusCode,
      status_message:   'Successfully completed',
      method:           'VISA',
      card_holder_name: 'Demo Customer',
      card_no:          '411111XXXXXX1111',
      card_expiry:      '12/28',
      md5sig,
    };

    // Fire the IPN to the real webhook handler on this same server
    const webhookEndpoint = webhookUrl();
    let ipnOk = false;
    try {
      const ipnRes = await axios.post(webhookEndpoint, qs.stringify(ipnPayload), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });
      ipnOk = ipnRes.status === 200;
      console.log(`[MOCK PAYHERE] IPN response: ${ipnRes.status}`);
    } catch (ipnErr) {
      console.error('[MOCK PAYHERE] IPN call failed:', ipnErr.message);
      return res.json({ success: false, message: `IPN webhook failed: ${ipnErr.message}` });
    }

    // Fetch the receipt number from the payment record
    const { Payment } = require('../models');
    const payment = await Payment.findOne({
      where:  { order_id },
      order:  [['created_at', 'DESC']],
    });

    console.log(`[MOCK PAYHERE] ✅ Payment ${order_id} processed — status: ${payment?.payment_status}`);
    return res.json({
      success:        true,
      receipt_number: payment?.receipt_number ?? 'MOCK-RECEIPT',
      status:         payment?.payment_status,
    });

  } catch (err) {
    console.error('[MOCK PAYHERE] Error:', err.message);
    return res.json({ success: false, message: err.message });
  }
});

module.exports = router;
