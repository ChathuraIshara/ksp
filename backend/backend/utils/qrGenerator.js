const QRCode = require('qrcode');
const path = require('path');
const env = require('../config/env');

const generateQR = async (data, filename) => {
  const outputPath = path.join(env.upload.path, 'certificates', filename);
  await QRCode.toFile(outputPath, JSON.stringify(data), { width: 200 });
  return outputPath;
};

module.exports = { generateQR };
