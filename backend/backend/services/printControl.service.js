const { CertificatePrintLog } = require('../models');

const getNextPrintNumber = async (certificateId) => {
  const count = await CertificatePrintLog.count({ where: { certificate_id: certificateId } });
  return count + 1;
};

const isFirstPrint = async (certificateId) => {
  const count = await CertificatePrintLog.count({ where: { certificate_id: certificateId } });
  return count === 0;
};

const recordPrint = async (certificateId, certType, referenceNumber, printedBy, reason = null) => {
  const printNumber = await getNextPrintNumber(certificateId);
  const isFirst = printNumber === 1;

  const log = await CertificatePrintLog.create({
    certificate_id: certificateId,
    certificate_type: certType,
    reference_number: referenceNumber,
    print_number: printNumber,
    printed_by: printedBy,
    printed_at: new Date(),
    reason: !isFirst ? reason : null,
  });

  return { log, isFirst, printNumber };
};

module.exports = { getNextPrintNumber, isFirstPrint, recordPrint };
