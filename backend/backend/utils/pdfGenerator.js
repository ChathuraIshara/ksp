/**
 * pdfGenerator.js
 *
 * Generates Sinhala-language PDFs for:
 *  1. Building Approval Certificate  (ගොඩනැගිලි අනුමත සහතිකය)
 *  2. Certificate of Conformity/COR  (ගොඩනැගිලි අනුකූලතා සහතිකය)
 *  3. Payment Receipt
 *
 * Uses PDFKit. Sinhala text is rendered via the bundled Noto Serif Sinhala font.
 * If the font file is absent the generator falls back to English gracefully so
 * development never breaks.
 */

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');
const env         = require('../config/env');

// ── Font paths ────────────────────────────────────────────────────────────────
const FONT_DIR        = path.join(__dirname, '..', 'assets', 'fonts');
const SINHALA_FONT    = path.join(FONT_DIR, 'NotoSerifSinhala-Regular.ttf');
const SINHALA_BOLD    = path.join(FONT_DIR, 'NotoSerifSinhala-Bold.ttf');
const FALLBACK_FONT   = 'Helvetica';
const FALLBACK_BOLD   = 'Helvetica-Bold';
const KPS_LOGO        = path.join(__dirname, '..', 'assets', 'images', 'kps_logo.png');

const hasSinhalaFont  = fs.existsSync(SINHALA_FONT);
const hasSinhalaBold  = fs.existsSync(SINHALA_BOLD);
const hasLogo         = fs.existsSync(KPS_LOGO);

// ── Ensure output directories exist ─────────────────────────────────────────
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

// ── Helper: register fonts on a doc instance ─────────────────────────────────
const registerFonts = (doc) => {
  if (hasSinhalaFont)  doc.registerFont('Sinhala',      SINHALA_FONT);
  if (hasSinhalaBold)  doc.registerFont('SinhalaBold',  SINHALA_BOLD);
};

const fontRegular = (doc) => hasSinhalaFont  ? doc.font('Sinhala')     : doc.font(FALLBACK_FONT);
const fontBold    = (doc) => hasSinhalaBold  ? doc.font('SinhalaBold') : doc.font(FALLBACK_BOLD);

// ── KPS blue brand colour ─────────────────────────────────────────────────────
const KPS_BLUE   = '#1A5276';
const KPS_LIGHT  = '#D6EAF8';
const TEXT_DARK  = '#1C2833';

// ─────────────────────────────────────────────────────────────────────────────
// APPROVAL CERTIFICATE
// ගොඩනැගිලි අනුමත සහතිකය
// ─────────────────────────────────────────────────────────────────────────────
const generateApprovalCertificatePDF = (data, outputFilename) => {
  return new Promise((resolve, reject) => {
    const certDir = path.join(env.upload.path, 'certificates');
    ensureDir(certDir);
    const outputPath = path.join(certDir, outputFilename);

    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title:   'ගොඩනැගිලි අනුමත සහතිකය',
      Author:  'කැලණිය ප්‍රාදේශීය සභාව',
      Subject: 'Building Plan Approval Certificate',
    }});

    registerFonts(doc);
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // ── Header band ───────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 110).fill(KPS_BLUE);

    if (hasLogo) {
      try { doc.image(KPS_LOGO, 40, 15, { width: 70, height: 70 }); } catch (_) {}
    }

    fontBold(doc);
    doc.fillColor('#FFFFFF').fontSize(18).text('කැලණිය ප්‍රාදේශීය සභාව', 130, 22, { align: 'left' });
    doc.fontSize(11).text('Kelaniya Pradeshiya Sabha', 130, 46, { align: 'left' });

    fontRegular(doc);
    doc.fontSize(9).fillColor(KPS_LIGHT)
       .text('ගොඩනැගිලි අනුමත සහතිකය', 130, 65)
       .text('Building Plan Approval Certificate', 130, 80);

    // ── Certificate number box ────────────────────────────────────────────────
    doc.rect(40, 120, 515, 36).fill(KPS_LIGHT).stroke(KPS_BLUE);
    fontBold(doc);
    doc.fillColor(KPS_BLUE).fontSize(11)
       .text(`සහතික අංකය / Certificate No: ${data.certNumber || '—'}`, 50, 131)
       .text(`යොමු අංකය / Reference No: ${data.reference_number || '—'}`, 300, 131);

    // ── Decorative border ─────────────────────────────────────────────────────
    doc.rect(40, 165, 515, 560).stroke(KPS_BLUE);
    doc.rect(44, 169, 507, 552).stroke('#AED6F1');

    // ── Section: Applicant details ────────────────────────────────────────────
    fontBold(doc);
    doc.fillColor(KPS_BLUE).fontSize(12).text('1. අයදුම්කරු තොරතුරු / Applicant Details', 55, 178);
    doc.moveTo(55, 193).lineTo(540, 193).stroke(KPS_BLUE);

    fontRegular(doc);
    doc.fillColor(TEXT_DARK).fontSize(10);

    const row = (label, value, y) => {
      fontBold(doc);
      doc.fillColor(KPS_BLUE).text(label, 60, y, { width: 180 });
      fontRegular(doc);
      doc.fillColor(TEXT_DARK).text(String(value || '—'), 245, y, { width: 300 });
    };

    let y = 200;
    row('නම / Name',                        data.applicant_name,      y); y += 18;
    row('ලිපිනය / Address',                 data.applicant_address,   y); y += 18;
    row('ජාතික හැඳුනුම්පත / NIC',           data.applicant_nic,        y); y += 18;
    row('දුරකථනය / Phone',                  data.applicant_phone,     y); y += 22;

    // ── Section: Property ─────────────────────────────────────────────────────
    fontBold(doc);
    doc.fillColor(KPS_BLUE).fontSize(12).text('2. දේපළ තොරතුරු / Property Details', 55, y); y += 16;
    doc.moveTo(55, y).lineTo(540, y).stroke(KPS_BLUE); y += 8;

    fontRegular(doc);
    doc.fillColor(TEXT_DARK).fontSize(10);
    row('විකුණුම් අංකය / Assessment No.',   data.tax_number,          y); y += 18;
    row('දේපළ ලිපිනය / Property Address',   data.property_address,    y); y += 18;
    row('වාර්ඩ / Ward',                      data.ward,                y); y += 18;
    row('සැලැස්ම වර්ගය / Plan Type',         data.plan_type,           y); y += 18;
    row('ඉදිකිරීම් විස්තරය / Description',  data.construction_description, y); y += 22;

    // ── Section: Approval ─────────────────────────────────────────────────────
    fontBold(doc);
    doc.fillColor(KPS_BLUE).fontSize(12).text('3. අනුමතිය / Approval', 55, y); y += 16;
    doc.moveTo(55, y).lineTo(540, y).stroke(KPS_BLUE); y += 8;

    fontRegular(doc);
    doc.fillColor(TEXT_DARK).fontSize(10);
    row('අනුමතිය ලැබුණු දිනය / Approval Date',   data.approval_date,   y); y += 18;
    row('කල් ඉකුත් වන දිනය / Expiry Date',        data.expiry_date,     y); y += 18;
    row('වලංගු කාලය / Validity Period',            'වසර 5 / 5 Years',   y); y += 22;

    if (data.conditions) {
      fontBold(doc);
      doc.fillColor(KPS_BLUE).fontSize(10).text('කොන්දේසි / Conditions:', 60, y); y += 14;
      fontRegular(doc);
      doc.fillColor(TEXT_DARK).fontSize(9)
         .text(data.conditions, 60, y, { width: 475, lineGap: 3 });
      y += doc.heightOfString(data.conditions, { width: 475 }) + 10;
    }

    // ── QR code ───────────────────────────────────────────────────────────────
    if (data.qrPath && fs.existsSync(data.qrPath)) {
      try { doc.image(data.qrPath, 440, y, { width: 80, height: 80 }); } catch (_) {}
    }
    fontRegular(doc);
    doc.fillColor(TEXT_DARK).fontSize(8)
       .text('සත්‍යාපන කේතය', 440, y + 82, { width: 80, align: 'center' })
       .text('Verification QR', 440, y + 92, { width: 80, align: 'center' });

    // ── Signature block ───────────────────────────────────────────────────────
    const sigY = y + 10;
    doc.moveTo(55, sigY + 40).lineTo(200, sigY + 40).stroke(TEXT_DARK);
    fontRegular(doc);
    doc.fillColor(TEXT_DARK).fontSize(9)
       .text('සභාපතිගේ අත්සන', 55, sigY + 44)
       .text('Chairman\'s Signature', 55, sigY + 56);

    doc.moveTo(250, sigY + 40).lineTo(420, sigY + 40).stroke(TEXT_DARK);
    doc.fillColor(TEXT_DARK).fontSize(9)
       .text('නිල මුද්‍රාව / Official Seal', 250, sigY + 44)
       .text('Pradeshiya Sabha', 250, sigY + 56);

    // ── Legal disclaimer ──────────────────────────────────────────────────────
    doc.rect(40, sigY + 80, 515, 40).fill('#EAFAF1');
    fontRegular(doc);
    doc.fillColor('#1D8348').fontSize(8)
       .text('මෙම සහතිකය ශ්‍රී ලංකා ඉලෙක්ට්‍රොනික ගනුදෙනු පනත යටතේ නීතිමය වශයෙන් වලංගු ඩිජිටල් අත්සනකින් සහතික කර ඇත.', 50, sigY + 87, { width: 495, align: 'center' })
       .text('This certificate is digitally signed and is legally valid under the Sri Lanka Electronic Transactions Act No. 19 of 2006.', 50, sigY + 99, { width: 495, align: 'center' });

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, 790, 595, 50).fill(KPS_BLUE);
    fontRegular(doc);
    doc.fillColor('#FFFFFF').fontSize(8)
       .text('කැලණිය ප්‍රාදේශීය සභාව | Kelaniya Pradeshiya Sabha | දුරකථනය / Tel: 011-XXXXXXX', 0, 800, { width: 595, align: 'center' })
       .text(`Printed: ${new Date().toLocaleString('si-LK')}  |  Cert: ${data.certNumber || ''}  |  Ref: ${data.reference_number || ''}`, 0, 814, { width: 595, align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATE OF CONFORMITY (COC / COR)
// ගොඩනැගිලි අනුකූලතා සහතිකය
// ─────────────────────────────────────────────────────────────────────────────
const generateCORCertificatePDF = (data, outputFilename) => {
  return new Promise((resolve, reject) => {
    const certDir = path.join(env.upload.path, 'certificates');
    ensureDir(certDir);
    const outputPath = path.join(certDir, outputFilename);

    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title:   'ගොඩනැගිලි අනුකූලතා සහතිකය',
      Author:  'කැලණිය ප්‍රාදේශීය සභාව',
      Subject: 'Certificate of Conformity',
    }});

    registerFonts(doc);
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // ── Header band ───────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 110).fill('#0B5345');

    if (hasLogo) {
      try { doc.image(KPS_LOGO, 40, 15, { width: 70, height: 70 }); } catch (_) {}
    }

    fontBold(doc);
    doc.fillColor('#FFFFFF').fontSize(18).text('කැලණිය ප්‍රාදේශීය සභාව', 130, 22);
    doc.fontSize(11).text('Kelaniya Pradeshiya Sabha', 130, 46);
    fontRegular(doc);
    doc.fontSize(9).fillColor('#A9DFBF')
       .text('ගොඩනැගිලි අනුකූලතා සහතිකය', 130, 65)
       .text('Certificate of Conformity (COC)', 130, 80);

    // ── COR number box ────────────────────────────────────────────────────────
    doc.rect(40, 120, 515, 36).fill('#D5F5E3').stroke('#0B5345');
    fontBold(doc);
    doc.fillColor('#0B5345').fontSize(11)
       .text(`COC අංකය / COC No: ${data.corNumber || '—'}`, 50, 131)
       .text(`යොමු අංකය / Ref: ${data.reference_number || '—'}`, 300, 131);

    doc.rect(40, 165, 515, 580).stroke('#0B5345');
    doc.rect(44, 169, 507, 572).stroke('#A9DFBF');

    let y = 180;
    fontBold(doc);
    doc.fillColor('#0B5345').fontSize(12).text('1. අයදුම්කරු / Applicant', 55, y); y += 16;
    doc.moveTo(55, y).lineTo(540, y).stroke('#0B5345'); y += 8;

    fontRegular(doc);
    doc.fillColor(TEXT_DARK).fontSize(10);

    const row = (label, value, yPos) => {
      fontBold(doc);
      doc.fillColor('#0B5345').text(label, 60, yPos, { width: 180 });
      fontRegular(doc);
      doc.fillColor(TEXT_DARK).text(String(value || '—'), 245, yPos, { width: 300 });
    };

    row('නම / Name',                   data.applicant_name,    y); y += 18;
    row('ලිපිනය / Address',            data.applicant_address, y); y += 18;
    row('ජාතික හැඳුනුම්පත / NIC',      data.applicant_nic,     y); y += 22;

    fontBold(doc);
    doc.fillColor('#0B5345').fontSize(12).text('2. දේපළ / Property', 55, y); y += 16;
    doc.moveTo(55, y).lineTo(540, y).stroke('#0B5345'); y += 8;

    row('විකුණුම් අංකය / Assessment No.', data.tax_number,          y); y += 18;
    row('ලිපිනය / Address',              data.property_address,   y); y += 18;
    row('සැලැස්ම වර්ගය / Plan Type',      data.plan_type,          y); y += 22;

    fontBold(doc);
    doc.fillColor('#0B5345').fontSize(12).text('3. අනුකූලතාව / Conformity Details', 55, y); y += 16;
    doc.moveTo(55, y).lineTo(540, y).stroke('#0B5345'); y += 8;

    row('මුල් අනුමතිය / Original Approval Date',    data.approval_date,         y); y += 18;
    row('ඉදිකිරීම් සම්පූර්ණ / Construction Date',   data.construction_date,     y); y += 18;
    row('අවසන් පරීක්ෂාව / Final Inspection Date',   data.final_inspection_date, y); y += 18;
    row('COC නිකුත් කළ දිනය / COC Issued Date',     data.issued_date || new Date().toLocaleDateString('si-LK'), y); y += 22;

    // ── Declaration box ───────────────────────────────────────────────────────
    doc.rect(55, y, 480, 60).fill('#D5F5E3');
    fontBold(doc);
    doc.fillColor('#0B5345').fontSize(10)
       .text('නිල ප්‍රකාශය / Official Declaration', 65, y + 6);
    fontRegular(doc);
    doc.fillColor(TEXT_DARK).fontSize(9)
       .text(
         'ඉහත කී ගොඩනැගිල්ල අනුමත සැලැස්ම හා සියලු කොන්දේසිවලට අනුකූලව ඉදිකර ඇති බව මෙයින් සහතික කෙරේ. ' +
         'It is hereby certified that the above-mentioned building has been constructed in conformity with the approved plan and all conditions.',
         65, y + 20, { width: 460, lineGap: 2 }
       );
    y += 75;

    // ── QR ───────────────────────────────────────────────────────────────────
    if (data.qrPath && fs.existsSync(data.qrPath)) {
      try { doc.image(data.qrPath, 440, y, { width: 80, height: 80 }); } catch (_) {}
    }

    // ── Signatures ────────────────────────────────────────────────────────────
    doc.moveTo(55, y + 50).lineTo(210, y + 50).stroke(TEXT_DARK);
    fontRegular(doc);
    doc.fillColor(TEXT_DARK).fontSize(9)
       .text('කාර්මික නිලධාරි / Technical Officer', 55, y + 54)
       .text(data.to_name || '', 55, y + 66);

    doc.moveTo(250, y + 50).lineTo(420, y + 50).stroke(TEXT_DARK);
    doc.fillColor(TEXT_DARK).fontSize(9)
       .text('සභාපති / Chairman', 250, y + 54)
       .text('කැලණිය ප්‍රාදේශීය සභාව', 250, y + 66);

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, 790, 595, 50).fill('#0B5345');
    fontRegular(doc);
    doc.fillColor('#FFFFFF').fontSize(8)
       .text('කැලණිය ප්‍රාදේශීය සභාව | Kelaniya Pradeshiya Sabha | දුරකථනය / Tel: 011-XXXXXXX', 0, 800, { width: 595, align: 'center' })
       .text(`Printed: ${new Date().toLocaleString('si-LK')}  |  COC: ${data.corNumber || ''}`, 0, 814, { width: 595, align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT RECEIPT
// ─────────────────────────────────────────────────────────────────────────────
const generateReceiptPDF = (data, outputFilename) => {
  return new Promise((resolve, reject) => {
    const receiptDir = path.join(env.upload.path, 'receipts');
    ensureDir(receiptDir);
    const outputPath = path.join(receiptDir, outputFilename);

    const doc = new PDFDocument({ size: 'A5', margin: 40, info: { Title: 'Payment Receipt' }});
    registerFonts(doc);
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.rect(0, 0, 420, 60).fill(KPS_BLUE);
    fontBold(doc);
    doc.fillColor('#FFFFFF').fontSize(14).text('කැලණිය ප්‍රාදේශීය සභාව', 0, 12, { align: 'center', width: 420 });
    doc.fontSize(9).text('Kelaniya Pradeshiya Sabha — Payment Receipt', 0, 32, { align: 'center', width: 420 });

    let y = 72;
    fontBold(doc);
    doc.fillColor(KPS_BLUE).fontSize(11)
       .text(`රිසිට්පත් අංකය: ${data.receipt_number || '—'}`, 40, y); y += 20;

    const rRow = (lbl, val, yPos) => {
      fontBold(doc);
      doc.fillColor(KPS_BLUE).fontSize(9).text(lbl, 40, yPos, { width: 160 });
      fontRegular(doc);
      doc.fillColor(TEXT_DARK).text(String(val || '—'), 205, yPos, { width: 175 });
    };

    rRow('යොමු අංකය / Ref No.', data.reference_number, y); y += 16;
    rRow('ගෙවීම් වර්ගය / Payment Type', data.payment_type, y); y += 16;
    rRow('ගෙවීම් ක්‍රමය / Method', data.payment_method, y); y += 16;
    rRow('ගෙවූ දිනය / Date', data.paid_at ? new Date(data.paid_at).toLocaleDateString('si-LK') : new Date().toLocaleDateString('si-LK'), y); y += 20;

    doc.rect(40, y, 340, 36).fill(KPS_LIGHT);
    fontBold(doc);
    doc.fillColor(KPS_BLUE).fontSize(14)
       .text(`මුළු මුදල / Total: Rs. ${Number(data.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 50, y + 10);
    y += 50;

    doc.rect(40, y, 340, 24).fill('#EAF3DE');
    fontRegular(doc);
    doc.fillColor('#1D8348').fontSize(8)
       .text('ගෙවීම ලැබිණ. This is an official receipt issued by Kelaniya Pradeshiya Sabha.', 50, y + 7, { width: 320 });

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
};

// ── Unified entry point used by certificate.service.js ───────────────────────
const generateCertificatePDF = (data, outputFilename, type = 'APPROVAL') => {
  if (type === 'COR') return generateCORCertificatePDF(data, outputFilename);
  return generateApprovalCertificatePDF(data, outputFilename);
};

module.exports = {
  generateCertificatePDF,
  generateApprovalCertificatePDF,
  generateCORCertificatePDF,
  generateReceiptPDF,
};
