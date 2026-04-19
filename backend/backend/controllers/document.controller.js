const { Document, User } = require('../models');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');
const notifService = require('../services/notification.service');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Helper: find a PSO to notify when a bank slip is uploaded
const findActivePSO = async () => {
  const pso = await User.findOne({ where: { role: 'PSO', status: 'ACTIVE' } });
  return pso?.user_id || null;
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return badRequest(res, 'No file uploaded');

    // Verify magic bytes — prevents renamed executables masquerading as PDFs
    const ext = path.extname(req.file.originalname).replace('.', '').toLowerCase();
    const uploadHandler = require('../middleware/uploadHandler');
    if (uploadHandler.verifyMagicBytes && !uploadHandler.verifyMagicBytes(req.file.path, ext)) {
      const fs = require('fs');
      try { fs.unlinkSync(req.file.path); } catch {}
      return badRequest(res, 'File content does not match its extension. Upload rejected.');
    }
    // Support appId in URL params (e.g. POST /documents/upload/:appId)
    if (req.params.appId && !req.body.application_id) {
      req.body.application_id = req.params.appId;
    }
    const category = req.body.category || 'GENERAL';
    const doc = await Document.create({
      reference_number: req.body.reference_number,
      application_id: req.body.application_id,
      uploaded_by: req.user.user_id,
      category,
      original_filename: req.file.originalname,
      stored_filename: req.file.filename,
      file_path: req.file.path,
      file_type: path.extname(req.file.originalname).slice(1).toUpperCase(),
      file_size_kb: Math.round(req.file.size / 1024),
    });

    // ── Notify PSO when a bank slip is uploaded ────────────────────────────
    if (category === 'BANK_SLIP' || category === 'PAYMENT_SLIP') {
      setImmediate(async () => {
        try {
          const psoId = await findActivePSO();
          if (psoId) {
            await notifService.dispatch({
              recipient_id:     psoId,
              event_type:       'BANK_SLIP_UPLOADED',
              title:            'Bank Slip Uploaded — Verification Required',
              body:             `An applicant has uploaded a bank slip for application ${req.body.reference_number || 'unknown'}.

Please log in to verify the payment and mark it as confirmed.`,
              reference_number: req.body.reference_number || null,
            });
          }
        } catch (e) {
          console.error('[DOC UPLOAD] PSO notify error:', e.message);
        }
      });
    }

    return created(res, doc);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const docs = await Document.findAll({ where: { reference_number: req.params.ref, is_current: true } });
    return success(res, docs);
  } catch (err) { next(err); }
};

exports.getByCategory = async (req, res, next) => {
  try {
    const docs = await Document.findAll({ where: { reference_number: req.params.ref, category: req.params.category, is_current: true } });
    return success(res, docs);
  } catch (err) { next(err); }
};

exports.getCurrentVersion = async (req, res, next) => {
  try {
    const doc = await Document.findOne({ where: { document_id: req.params.id, is_current: true } });
    if (!doc) return notFound(res);
    return success(res, doc);
  } catch (err) { next(err); }
};

exports.getVersionHistory = async (req, res, next) => {
  try {
    // Follow superseded_by chain
    const current = await Document.findByPk(req.params.id);
    if (!current) return notFound(res);
    // Find all versions with same original category and reference
    const versions = await Document.findAll({ where: { reference_number: current.reference_number, category: current.category }, order: [['version_number','ASC']] });
    return success(res, versions);
  } catch (err) { next(err); }
};

exports.uploadNewVersion = async (req, res, next) => {
  try {
    if (!req.file) return badRequest(res, 'No file uploaded');

    // Verify magic bytes — prevents renamed executables masquerading as PDFs
    const ext = path.extname(req.file.originalname).replace('.', '').toLowerCase();
    const uploadHandler = require('../middleware/uploadHandler');
    if (uploadHandler.verifyMagicBytes && !uploadHandler.verifyMagicBytes(req.file.path, ext)) {
      const fs = require('fs');
      try { fs.unlinkSync(req.file.path); } catch {}
      return badRequest(res, 'File content does not match its extension. Upload rejected.');
    }
    const old = await Document.findByPk(req.params.id);
    if (!old) return notFound(res);
    await old.update({ is_current: false });
    const newDoc = await Document.create({
      reference_number: old.reference_number, application_id: old.application_id,
      uploaded_by: req.user.user_id, category: old.category,
      original_filename: req.file.originalname, stored_filename: req.file.filename,
      file_path: req.file.path, file_type: path.extname(req.file.originalname).slice(1).toUpperCase(),
      file_size_kb: Math.round(req.file.size / 1024), version_number: (old.version_number || 1) + 1,
    });
    await old.update({ superseded_by: newDoc.document_id });
    return created(res, newDoc);
  } catch (err) { next(err); }
};

exports.verifyDocument = async (req, res, next) => {
  try {
    await Document.update({ verification_status: 'VERIFIED', verified_by: req.user.user_id, verified_at: new Date() }, { where: { document_id: req.params.id } });
    return success(res, null, 'Document verified');
  } catch (err) { next(err); }
};

exports.rejectDocument = async (req, res, next) => {
  try {
    const { rejection_reason } = req.body;
    if (!rejection_reason || rejection_reason.trim().length < 10) {
      return badRequest(res, 'Rejection reason must be at least 10 characters and descriptive');
    }
    await Document.update({ verification_status: 'REJECTED', rejection_reason, verified_by: req.user.user_id, verified_at: new Date() }, { where: { document_id: req.params.id } });
    return success(res, null, 'Document rejected');
  } catch (err) { next(err); }
};

exports.markSuperseded = async (req, res, next) => {
  try {
    await Document.update({ is_current: false }, { where: { document_id: req.params.id } });
    return success(res, null, 'Marked as superseded');
  } catch (err) { next(err); }
};

exports.validateFile = async (req, res, next) => {
  try {
    return success(res, { valid: !!req.file, filename: req.file?.originalname });
  } catch (err) { next(err); }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const { Document } = require('../models');
    const { notFound, success, forbidden, error } = require('../utils/responseHelper');
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return notFound(res, 'Document not found');
    // Only uploader or admin can delete; never delete if document is verified
    if (doc.verification_status === 'VERIFIED') return forbidden(res, 'Verified documents cannot be deleted');
    if (doc.uploaded_by !== req.user.user_id && req.user.role !== 'ADMIN')
      return forbidden(res, 'You can only delete your own documents');
    await doc.destroy();
    return success(res, null, 'Document deleted');
  } catch (err) { require('../utils/responseHelper').error(res, err.message); }
};
