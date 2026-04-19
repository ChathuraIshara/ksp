const { Fine, Payment } = require('../models');

const checkFinesPaid = async (referenceNumber) => {
  const unpaidFines = await Fine.findAll({
    where: { reference_number: referenceNumber, payment_status: 'PENDING' },
  });
  return { cleared: unpaidFines.length === 0, unpaidCount: unpaidFines.length };
};

const checkPaymentClearance = async (referenceNumber, paymentType) => {
  const payment = await Payment.findOne({
    where: { reference_number: referenceNumber, payment_type: paymentType, payment_status: 'COMPLETED' },
  });
  return { cleared: !!payment, payment };
};

const checkAllClear = async (referenceNumber, requiredPaymentType) => {
  const fines = await checkFinesPaid(referenceNumber);
  const payment = await checkPaymentClearance(referenceNumber, requiredPaymentType);
  return {
    allClear: fines.cleared && payment.cleared,
    fines,
    payment,
  };
};

module.exports = { checkFinesPaid, checkPaymentClearance, checkAllClear };
