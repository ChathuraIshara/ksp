const crypto = require('crypto');
const env = require('../config/env');

const getSecretHash = () => {
  if (!env.payhere.secret) throw new Error('PayHere is not configured. Set PAYHERE_MERCHANT_ID, PAYHERE_SECRET, PAYHERE_URL in .env');
  return crypto.createHash('md5').update(env.payhere.secret).digest('hex').toUpperCase();
};

const initiatePayment = async ({ referenceNumber, amount, paymentType, returnUrl, cancelUrl }) => {
  const secretHash = getSecretHash(); // throws early with clear message if not configured
  const orderId = `${referenceNumber}-${Date.now()}`;
  const hash = crypto.createHash('md5')
    .update(`${env.payhere.merchantId}${orderId}${amount.toFixed(2)}LKR${secretHash}`)
    .digest('hex').toUpperCase();

  return {
    paymentUrl: env.payhere.url,
    params: {
      merchant_id: env.payhere.merchantId,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: `${process.env.APP_URL || process.env.BASE_URL || 'https://kps.lk'}/api/v1/payments/webhook`,
      order_id: orderId,
      items: paymentType,
      currency: 'LKR',
      amount: amount.toFixed(2),
      hash,
    },
  };
};

const verifyWebhookSignature = (payload) => {
  const secretHash = getSecretHash();
  const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = payload;
  const expected = crypto.createHash('md5')
    .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`)
    .digest('hex').toUpperCase();
  return expected === md5sig;
};

module.exports = { initiatePayment, verifyWebhookSignature };
