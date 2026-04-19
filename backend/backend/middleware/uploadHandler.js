const multer = require('multer');
const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const MAGIC_BYTES = {
  pdf:  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 },
  jpg:  { bytes: [0xFF, 0xD8, 0xFF],        offset: 0 },
  jpeg: { bytes: [0xFF, 0xD8, 0xFF],        offset: 0 },
  png:  { bytes: [0x89, 0x50, 0x4E, 0x47],  offset: 0 },
};

const verifyMagicBytes = (filePath, ext) => {
  const sig = MAGIC_BYTES[ext];
  if (!sig) return false;
  try {
    const buf = Buffer.alloc(sig.bytes.length + sig.offset);
    const fd  = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return sig.bytes.every((b, i) => buf[i + sig.offset] === b);
  } catch { return false; }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const cat = req.uploadCategory || 'documents';
    cb(null, path.join(env.upload.path, cat));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, JPG, and PNG files are allowed'), false);
};

const csvFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype || '';
  if (ext === '.csv' || mime === 'text/csv' || mime === 'application/vnd.ms-excel') {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed for tax import'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: (env.upload.maxFileSizeMB || 10) * 1024 * 1024 },
});

const csvUpload = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = upload;
module.exports.csv = csvUpload;
module.exports.verifyMagicBytes = verifyMagicBytes;