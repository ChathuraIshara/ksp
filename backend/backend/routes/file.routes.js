const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const auth   = require('../middleware/auth');
const env    = require('../config/env');
const { unauthorized, notFound, forbidden } = require('../utils/responseHelper');

/**
 * GET /api/v1/files/:category/:filename
 *
 * Authenticated file download — replaces the removed public /uploads static route.
 * Only logged-in users may download files.  Officers can download any file;
 * applicants may only download files whose stored_filename belongs to their own
 * documents (checked against the Document table).
 */
router.get('/:category/:filename', auth, async (req, res) => {
  try {
    const { category, filename } = req.params;

    // Basic path-traversal guard — reject any segment containing '..'
    if (category.includes('..') || filename.includes('..')) {
      return forbidden(res, 'Invalid path');
    }

    const OFFICER_ROLES = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];
    const isOfficer = OFFICER_ROLES.includes(req.user.role);

    // Applicants must own the document
    if (!isOfficer) {
      const { Document } = require('../models');
      const doc = await Document.findOne({ where: { stored_filename: filename } });
      if (!doc) return notFound(res, 'File not found');

      const { Applicant } = require('../models');
      const applicant = await Applicant.findOne({ where: { user_id: req.user.user_id } });
      if (!applicant || doc.uploaded_by !== req.user.user_id) {
        return forbidden(res, 'Access denied');
      }
    }

    const filePath = path.join(env.upload.path, category, filename);

    if (!fs.existsSync(filePath)) return notFound(res, 'File not found');

    // Force download — prevents stored XSS from SVG/HTML files rendered in browser
    const fileName = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(path.resolve(filePath));
  } catch (err) {
    const isProduction = process.env.NODE_ENV === 'production';
    return res.status(500).json({ success: false, message: isProduction ? 'File access error' : err.message });
  }
});

module.exports = router;
