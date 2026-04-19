const { v4: uuidv4 } = require('uuid');
const { generateCertificatePDF } = require('../utils/pdfGenerator');
const { generateQR } = require('../utils/qrGenerator');
const { sign } = require('../utils/digitalSignature');

const generateApprovalCertificate = async (certData) => {
  const verificationCode = uuidv4();
  const certNumber = `CERT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

  const qrData = { certNumber, verificationCode, ref: certData.reference_number };
  const qrPath = await generateQR(qrData, `qr_${certNumber}.png`);

  const pdfPath = await generateCertificatePDF({ ...certData, certNumber, verificationCode }, `${certNumber}.pdf`, 'APPROVAL');
  const signature = sign({ certNumber, verificationCode, ref: certData.reference_number });

  return { certNumber, verificationCode, qrPath, pdfPath, signature };
};

const generateCORCertificate = async (certData) => {
  const verificationCode = uuidv4();
  const corNumber = `COR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

  const qrPath = await generateQR({ corNumber, verificationCode }, `qr_${corNumber}.png`);
  const pdfPath = await generateCertificatePDF({ ...certData, corNumber, verificationCode }, `${corNumber}.pdf`, 'COR');
  const signature = sign({ corNumber, verificationCode });

  return { corNumber, verificationCode, qrPath, pdfPath, signature };
};

module.exports = { generateApprovalCertificate, generateCORCertificate };
