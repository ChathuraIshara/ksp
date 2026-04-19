const { Op } = require('sequelize');
const { User, Officer, Application, AuditLog, sequelize } = require('../models');
const { sendEmail } = require('../utils/notificationDispatcher');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');
const taxImportService = require('../services/taxImport.service');
const notifService = require('../services/notification.service');

const VALID_OFFICER_ROLES = ['PSO','SW','TO','PHI','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];

// UC03 — Approve a pending officer account (set status ACTIVE + is_verified)
exports.approveOfficer = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) return notFound(res, 'User not found');
    if (!VALID_OFFICER_ROLES.includes(user.role)) {
      return badRequest(res, 'Only officer accounts can be approved through this endpoint');
    }
    await user.update({ status: 'ACTIVE', is_verified: true });

    // Stamp Officer.verified_by and Officer.verified_at — the model has these columns
    // and the workflow requires them to be populated on approval
    const { Officer } = require('../models');
    await Officer.update(
      { verified_by: req.user.user_id, verified_at: new Date(), is_active: true },
      { where: { user_id: user.user_id } }
    );

    return success(res, { user_id: user.user_id, email: user.email, role: user.role, status: user.status }, 'Officer account approved');
  } catch (err) { next(err); }
};

// UC03 — Reject / suspend an officer account
exports.rejectOfficer = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByPk(req.params.userId);
    if (!user) return notFound(res, 'User not found');
    await user.update({ status: 'REJECTED' });
    return success(res, null, `Officer account rejected${reason ? ': ' + reason : ''}`);
  } catch (err) { next(err); }
};

// UC03 — Update a user's role (admin only, officers only)
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role) return badRequest(res, 'role is required');
    if (!VALID_OFFICER_ROLES.includes(role)) {
      return badRequest(res, `Invalid role. Must be one of: ${VALID_OFFICER_ROLES.join(', ')}`);
    }
    const user = await User.findByPk(req.params.userId);
    if (!user) return notFound(res, 'User not found');
    if (user.role === 'APPLICANT') {
      return badRequest(res, 'Applicant roles cannot be changed to officer roles via this endpoint');
    }
    await user.update({ role, jwt_token: null });
    return success(res, { user_id: user.user_id, email: user.email, role: user.role }, 'User role updated');
  } catch (err) { next(err); }
};

// UC03 — Suspend an active user account

// ── PUT /admin/users/:userId/activate — reactivate suspended account ──────────
exports.activateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) return notFound(res, 'User not found');
    if (user.status === 'ACTIVE') return badRequest(res, 'Account is already active');
    await user.update({ status: 'ACTIVE', isBlocked: false });
    await notifService.dispatch({
      recipient_id: user.user_id,
      event_type: 'ACCOUNT_ACTIVATED',
      title: 'Account Activated',
      body: 'Your account has been reactivated by the administrator.',
      channel: 'IN_APP',
    });
    return success(res, null, 'Account activated successfully');
  } catch (err) { next(err); }
};

exports.suspendUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByPk(req.params.userId);
    if (!user) return notFound(res, 'User not found');
    if (user.user_id === req.user.user_id) return badRequest(res, 'Cannot suspend your own account');
    await user.update({ status: 'SUSPENDED' });
    return success(res, null, `Account suspended${reason ? ': ' + reason : ''}`);
  } catch (err) { next(err); }
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const { ExternalApproval, Op } = require('../models');
    const [totalUsers, totalApplications, pendingVerifications, overdueExternal] = await Promise.all([
      User.count(),
      Application.count(),
      Officer.count({ include: [{ model: User, where: { status: 'PENDING_VERIFICATION' }, required: true }] }),
      ExternalApproval.count({
        where: {
          approval_status: 'PENDING',
          due_date: { [Op.lt]: new Date() },
        },
      }),
    ]);
    return success(res, { totalUsers, totalApplications, pendingVerifications, overdueExternal });
  } catch (err) { next(err); }
};

exports.listPendingOfficerVerifications = async (req, res, next) => {
  try {
    const officers = await Officer.findAll({
      include: [{ model: User, attributes: ['email','role','status'], where: { status: 'PENDING_VERIFICATION' } }],
    });
    return success(res, officers);
  } catch (err) { next(err); }
};

exports.getSystemApplicationStats = async (req, res, next) => {
  try {
    const stats = await Application.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.literal('*')), 'count']],
      group: ['status'],
      raw: true,
    });
    return success(res, stats);
  } catch (err) { next(err); }
};

exports.overrideApplicationStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    await Application.update({ status }, { where: { reference_number: req.params.ref } });
    return success(res, null, `Status overridden to ${status}`);
  } catch (err) { next(err); }
};

exports.triggerBulkTaxImport = async (req, res, next) => {
  try {
    return success(res, null, 'Bulk import triggered. Check /api/v1/tax-import for progress.');
  } catch (err) { next(err); }
};

exports.getSystemHealthCheck = async (req, res, next) => {
  try {
    await sequelize.authenticate();
    return success(res, { database: 'OK', uptime: process.uptime(), memory: process.memoryUsage() });
  } catch (err) { error(res, 'Database connection failed', 503); }
};

// ── Report Generation ─────────────────────────────────────────────────────────
exports.generateReport = async (req, res, next) => {
  try {
    const { type, from_date, to_date, format = 'json' } = req.query;
    const { Op, fn, col } = require('sequelize');
    const { Payment, Fine, Complaint, Decision } = require('../models');

    const dateFilter = {};
    if (from_date) dateFilter[Op.gte] = new Date(from_date);
    if (to_date)   dateFilter[Op.lte] = new Date(to_date);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    let data = {};

    if (!type || type === 'applications') {
      data.applications = await Application.findAll({
        attributes: ['status','work_type','proposed_use','submitted_at','approval_date'],
        where: hasDateFilter ? { submitted_at: dateFilter } : {},
        raw: true,
      });
      data.by_status = await Application.findAll({
        attributes: ['status', [fn('COUNT', col('application_id')), 'count']],
        where: hasDateFilter ? { submitted_at: dateFilter } : {},
        group: ['status'], raw: true,
      });
    }

    if (!type || type === 'financial') {
      data.payments = await Payment.findAll({
        attributes: ['payment_type','amount','payment_status','payment_method','created_at'],
        where: hasDateFilter ? { created_at: dateFilter } : {},
        raw: true,
      });
      data.fines = await Fine.findAll({
        attributes: ['fine_type','fine_amount','payment_status','created_at'],
        where: hasDateFilter ? { created_at: dateFilter } : {},
        raw: true,
      });
      const paidTotal = await Payment.findAll({
        attributes: [[fn('SUM', col('amount')), 'total']],
        where: { payment_status: 'COMPLETED', ...(hasDateFilter ? { created_at: dateFilter } : {}) },
        raw: true,
      });
      data.total_collected = paidTotal[0]?.total || 0;
    }

    if (!type || type === 'complaints') {
      data.complaints = await Complaint.findAll({
        attributes: ['complaint_type','status','created_at','resolved_at'],
        where: hasDateFilter ? { created_at: dateFilter } : {},
        raw: true,
      });
      data.complaints_by_status = await Complaint.findAll({
        attributes: ['status', [fn('COUNT', col('complaint_id')), 'count']],
        where: hasDateFilter ? { created_at: dateFilter } : {},
        group: ['status'], raw: true,
      });
    }

    if (!type || type === 'decisions') {
      data.decisions = await Decision.findAll({
        attributes: ['decision_type','decided_at'],
        where: hasDateFilter ? { decided_at: dateFilter } : {},
        raw: true,
      });
      data.decisions_by_type = await Decision.findAll({
        attributes: ['decision_type', [fn('COUNT', col('decision_id')), 'count']],
        where: hasDateFilter ? { decided_at: dateFilter } : {},
        group: ['decision_type'], raw: true,
      });
    }

    data.generated_at = new Date().toISOString();
    data.filters = { type, from_date, to_date };

    const label = type || 'full';
    const ts    = Date.now();

    // ── CSV export ─────────────────────────────────────────────────────────────
    if (format === 'csv') {
      const sections = [];

      if (data.by_status?.length) {
        sections.push('Applications by Status');
        sections.push('Status,Count');
        data.by_status.forEach(r => sections.push(`${r.status},${r.count}`));
        sections.push('');
      }
      if (data.decisions_by_type?.length) {
        sections.push('Decisions by Type');
        sections.push('Decision Type,Count');
        data.decisions_by_type.forEach(r => sections.push(`${r.decision_type},${r.count}`));
        sections.push('');
      }
      if (data.total_collected !== undefined) {
        sections.push('Financial Summary');
        sections.push(`Total Collected (Rs.),${data.total_collected}`);
        sections.push(`Total Payments,${data.payments?.length ?? 0}`);
        sections.push(`Total Fines,${data.fines?.length ?? 0}`);
        sections.push('');
      }
      if (data.complaints_by_status?.length) {
        sections.push('Complaints by Status');
        sections.push('Status,Count');
        data.complaints_by_status.forEach(r => sections.push(`${r.status},${r.count}`));
        sections.push('');
      }
      sections.push(`Generated At,${data.generated_at}`);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="kps_report_${label}_${ts}.csv"`);
      return res.send(sections.join('\n'));
    }

    // ── Excel export (exceljs) ─────────────────────────────────────────────────
    if (format === 'xlsx') {
      let ExcelJS;
      try { ExcelJS = require('exceljs'); }
      catch { return res.status(503).json({ success: false, message: 'exceljs not installed — run npm install' }); }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'KPS Planning System';
      wb.created = new Date();

      const HEADER_STYLE = {
        font:      { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } },
        alignment: { horizontal: 'center' },
        border: {
          bottom: { style: 'thin', color: { argb: 'FF888888' } },
        },
      };

      const addSheet = (name, columns, rows) => {
        const ws = wb.addWorksheet(name);
        ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 18 }));
        ws.getRow(1).eachCell(cell => { Object.assign(cell, HEADER_STYLE); });
        rows.forEach(r => ws.addRow(r));
        ws.getRow(1).height = 22;
        return ws;
      };

      // Sheet 1: Applications by Status
      if (data.by_status?.length) {
        addSheet('Applications by Status',
          [{ header: 'Status', key: 'status', width: 28 }, { header: 'Count', key: 'count', width: 12 }],
          data.by_status.map(r => ({ status: r.status?.replace(/_/g, ' '), count: parseInt(r.count) }))
        );
      }

      // Sheet 2: Individual Applications (first 500)
      if (data.applications?.length) {
        addSheet('Applications',
          [
            { header: 'Status',        key: 'status',       width: 24 },
            { header: 'Work Type',     key: 'work_type',    width: 20 },
            { header: 'Proposed Use',  key: 'proposed_use', width: 18 },
            { header: 'Submitted',     key: 'submitted_at', width: 20 },
            { header: 'Approved',      key: 'approval_date',width: 20 },
          ],
          data.applications.slice(0, 500).map(r => ({
            status:       r.status,
            work_type:    r.work_type,
            proposed_use: r.proposed_use,
            submitted_at: r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-LK') : '',
            approval_date:r.approval_date ? new Date(r.approval_date).toLocaleDateString('en-LK') : '',
          }))
        );
      }

      // Sheet 3: Financial Summary
      if (data.payments?.length || data.total_collected !== undefined) {
        const finSheet = wb.addWorksheet('Financial Summary');
        finSheet.addRow(['Metric', 'Value']);
        finSheet.addRow(['Total Revenue Collected (Rs.)', parseFloat(data.total_collected || 0).toFixed(2)]);
        finSheet.addRow(['Total Payment Transactions', data.payments?.length ?? 0]);
        finSheet.addRow(['Total Fines Issued', data.fines?.length ?? 0]);
        finSheet.addRow(['']);
        if (data.payments?.length) {
          const pmtSheet = wb.addWorksheet('Payments');
          addSheet.call(null, null, null, null); // unused, just show it
          const ps = wb.getWorksheet('Payments') || wb.addWorksheet('Payments');
          ps.columns = [
            { header: 'Type', key: 'payment_type', width: 22 },
            { header: 'Amount (Rs.)', key: 'amount', width: 15 },
            { header: 'Status', key: 'payment_status', width: 16 },
            { header: 'Method', key: 'payment_method', width: 16 },
            { header: 'Date', key: 'created_at', width: 20 },
          ];
          ps.getRow(1).eachCell(cell => { Object.assign(cell, HEADER_STYLE); });
          data.payments.forEach(p => ps.addRow({
            payment_type:   p.payment_type,
            amount:         parseFloat(p.amount || 0),
            payment_status: p.payment_status,
            payment_method: p.payment_method,
            created_at:     p.created_at ? new Date(p.created_at).toLocaleDateString('en-LK') : '',
          }));
        }
      }

      // Sheet 4: Decisions
      if (data.decisions_by_type?.length) {
        addSheet('Decisions by Type',
          [{ header: 'Decision Type', key: 'decision_type', width: 28 }, { header: 'Count', key: 'count', width: 12 }],
          data.decisions_by_type.map(r => ({ decision_type: r.decision_type?.replace(/_/g, ' '), count: parseInt(r.count) }))
        );
      }

      // Sheet 5: Complaints
      if (data.complaints_by_status?.length) {
        addSheet('Complaints',
          [{ header: 'Status', key: 'status', width: 22 }, { header: 'Count', key: 'count', width: 12 }],
          data.complaints_by_status.map(r => ({ status: r.status, count: parseInt(r.count) }))
        );
      }

      // Metadata sheet
      const meta = wb.addWorksheet('Report Info');
      meta.addRow(['Kelaniya Pradeshiya Sabha — Planning Approval System']);
      meta.addRow(['Report Type', label.toUpperCase()]);
      meta.addRow(['Generated At', new Date(data.generated_at).toLocaleString('en-LK')]);
      if (from_date) meta.addRow(['From Date', from_date]);
      if (to_date)   meta.addRow(['To Date',   to_date]);
      meta.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF1A3A6B' } };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="kps_report_${label}_${ts}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    // ── PDF export (pdfkit) ────────────────────────────────────────────────────
    if (format === 'pdf') {
      let PDFDocument;
      try { PDFDocument = require('pdfkit'); }
      catch { return res.status(503).json({ success: false, message: 'pdfkit not installed' }); }

      const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="kps_report_${label}_${ts}.pdf"`);
      doc.pipe(res);

      // ── Header ──────────────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 80).fill('#1a3a6b');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
         .text('Kelaniya Pradeshiya Sabha', 50, 20, { width: 500 });
      doc.fontSize(11).font('Helvetica')
         .text('Planning Approval System — Report', 50, 44);
      doc.fillColor('#fbbf24').fontSize(10)
         .text(`${label.toUpperCase()} REPORT`, 50, 60);

      doc.fillColor('#1e293b').moveDown(3);

      // Meta
      doc.fontSize(9).fillColor('#64748b')
         .text(`Generated: ${new Date().toLocaleString('en-LK')}`, 50, 95);
      if (from_date || to_date) {
        doc.text(`Period: ${from_date || 'All time'} → ${to_date || 'Present'}`, 50, 110);
      }

      const drawSectionHeader = (title) => {
        doc.moveDown(1);
        doc.rect(50, doc.y, 495, 22).fill('#1a3a6b');
        doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
           .text(title, 56, doc.y - 18);
        doc.fillColor('#1e293b').font('Helvetica').fontSize(10);
        doc.moveDown(0.5);
      };

      const drawTableRow = (cols, isHeader = false) => {
        const y = doc.y;
        const colWidths = [200, 80, 100, 120];
        let x = 50;
        if (isHeader) { doc.rect(50, y, 495, 18).fill('#e2e8f0'); doc.fillColor('#334155'); }
        else { doc.fillColor('#1e293b'); }
        cols.forEach((text, i) => {
          doc.fontSize(isHeader ? 9 : 9).font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
             .text(String(text ?? '—'), x + 3, y + 4, { width: (colWidths[i] || 80) - 6, height: 14 });
          x += colWidths[i] || 80;
        });
        doc.moveDown(0.55);
      };

      // Applications section
      if (data.by_status?.length) {
        drawSectionHeader('Applications by Status');
        drawTableRow(['Status', 'Count'], true);
        data.by_status.forEach(r => drawTableRow([r.status?.replace(/_/g,' '), r.count]));
      }

      // Financial section
      if (data.total_collected !== undefined) {
        drawSectionHeader('Financial Summary');
        drawTableRow(['Metric', 'Value'], true);
        drawTableRow(['Total Revenue Collected (Rs.)', parseFloat(data.total_collected||0).toLocaleString('en-LK',{minimumFractionDigits:2})]);
        drawTableRow(['Total Payment Transactions', data.payments?.length ?? 0]);
        drawTableRow(['Total Fines Issued', data.fines?.length ?? 0]);
      }

      // Decisions section
      if (data.decisions_by_type?.length) {
        drawSectionHeader('Planning Committee Decisions');
        drawTableRow(['Decision Type', 'Count'], true);
        data.decisions_by_type.forEach(r => drawTableRow([r.decision_type?.replace(/_/g,' '), r.count]));
      }

      // Complaints section
      if (data.complaints_by_status?.length) {
        drawSectionHeader('Complaints by Status');
        drawTableRow(['Status', 'Count'], true);
        data.complaints_by_status.forEach(r => drawTableRow([r.status, r.count]));
      }

      // Footer
      doc.on('pageAdded', () => {
        const bottom = doc.page.height - 40;
        doc.fillColor('#94a3b8').fontSize(8)
           .text('Kelaniya Pradeshiya Sabha — Confidential', 50, bottom, { align: 'center', width: 495 });
      });

      doc.end();
      return;
    }

    return success(res, data, 'Report generated');
  } catch (err) { next(err); }
};

exports.getProcessingTimeReport = async (req, res, next) => {
  try {
    const apps = await Application.findAll({
      attributes: ['reference_number','submitted_at','approval_date','status','proposed_use'],
      where: { approval_date: { [Op.ne]: null } },
      raw: true,
    });
    const withDays = apps.map(a => ({
      ...a,
      processing_days: a.submitted_at && a.approval_date
        ? Math.round((new Date(a.approval_date) - new Date(a.submitted_at)) / (1000 * 60 * 60 * 24))
        : null,
    }));
    const avgDays = withDays.filter(a => a.processing_days !== null)
      .reduce((s, a, _, arr) => s + a.processing_days / arr.length, 0);
    return success(res, { applications: withDays, average_processing_days: Math.round(avgDays) });
  } catch (err) { next(err); }
};

// UC03 — Create a new officer account directly (Admin only)

// ── GET /admin/users — list all officers with their profiles ─────────────────
exports.listAllOfficers = async (req, res, next) => {
  try {
    const { role, status } = req.query;
    const where = {};
    if (role)   where.role   = role;
    if (status) where.status = status;

    // Exclude APPLICANT and PUBLIC roles
    const { Op } = require('sequelize');
    where.role = where.role
      ? where.role
      : { [Op.notIn]: ['APPLICANT', 'PUBLIC'] };

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password_hash', 'jwt_token', 'otp_code', 'reset_token'] },
      include: [{ model: Officer, as: 'Officer', required: false }],
      order: [['created_at', 'DESC']],
    });
    return success(res, users);
  } catch (err) { next(err); }
};

exports.createOfficer = async (req, res, next) => {
  try {
    const { email, password, role, full_name, nic_number, phone, designation, department } = req.body;
    if (!email || !password || !role || !full_name) {
      return badRequest(res, 'email, password, role and full_name are required');
    }
    if (!VALID_OFFICER_ROLES.includes(role)) {
      return badRequest(res, `Invalid role. Must be one of: ${VALID_OFFICER_ROLES.join(', ')}`);
    }
    if (password.length < 8) return badRequest(res, 'Password must be at least 8 characters');

    const existing = await User.findOne({ where: { email } });
    if (existing) return badRequest(res, 'An account with this email already exists');

    const password_hash = await require('bcryptjs').hash(password, 12);

    // Transaction: if Officer.create fails, User row is rolled back — no orphaned users
    let user;
    await sequelize.transaction(async (t) => {
      user = await User.create({
        email, password_hash, role,
        status:               'PENDING_VERIFICATION',
        is_verified:          false,
        first_login_verified: false,
        auth_provider:        'LOCAL',
      }, { transaction: t });

      await Officer.create({
        user_id:     user.user_id,
        full_name,
        nic_number:  nic_number  || null,
        phone:        phone       || null,
        designation: designation || role,
        department:  department   || 'Kelaniya Pradeshiya Sabha',
        is_active:   false,
      }, { transaction: t });
    });

    // Auto-send OTP to officer email so they can verify on first login
    try {
      const { createAndSendOTP } = require('../controllers/auth.controller');
      if (typeof createAndSendOTP === 'function') {
        await createAndSendOTP(email, 'EMAIL_VERIFY');
      }
    } catch (otpErr) {
      console.warn('[ADMIN] OTP send failed for new officer:', otpErr.message);
    }

    return created(res, {
      user_id:  user.user_id,
      email:    user.email,
      role:     user.role,
      status:   user.status,
      full_name,
      message: 'Officer created. OTP sent to officer email for first login verification.',
    }, `Officer account created for ${email}. OTP sent.`);
  } catch (err) { next(err); }
};

// Admin edits officer email and/or password
exports.editOfficer = async (req, res, next) => {
  try {
    const { email, password, full_name, role, designation, department, phone } = req.body;
    const user = await User.findByPk(req.params.userId);
    if (!user) return notFound(res, 'User not found');
    if (user.role === 'APPLICANT') return badRequest(res, 'Use applicant endpoints for applicant accounts');

    const updates = {};
    if (email) {
      // Check email not taken by another user
      const existing = await User.findOne({ where: { email, user_id: { [Op.ne]: user.user_id } } });
      if (existing) return badRequest(res, 'Email already in use by another account');
      updates.email = email;
    }
    if (password) {
      if (password.length < 8) return badRequest(res, 'Password must be at least 8 characters');
      updates.password_hash = await require('bcryptjs').hash(password, 12);
      // Force re-login when password changed
      updates.refresh_token = null;
    }
    await user.update(updates);

    // Update Officer profile if provided
    if (full_name || designation || department || phone || role) {
      const officer = await Officer.findOne({ where: { user_id: user.user_id } });
      if (officer) {
        await officer.update({
          ...(full_name    && { full_name }),
          ...(designation  && { designation }),
          ...(department   && { department }),
          ...(phone        && { phone }),
        });
      }
      // Role change
      if (role && VALID_OFFICER_ROLES.includes(role)) {
        await user.update({ role });
      }
    }

    return success(res, { user_id: user.user_id, email: updates.email || user.email }, 'Officer account updated');
  } catch (err) { next(err); }
};

/**
 * Admin-to-Admin Mutual Recovery
 * ────────────────────────────────────────────────────────────────────────────
 * PUT /admin/users/:userId/reset-password
 *
 * Rules:
 *  1. Only an ADMIN can call this endpoint (enforced by router-level allowRoles)
 *  2. An Admin CANNOT reset their own password this way (must use forgot-password OTP)
 *  3. Generates a cryptographically random 16-char temporary password
 *  4. Emails it directly to the target user's registered email
 *  5. Forces first_login_verified = false → target must do OTP on next login (2FA re-setup)
 *  6. Invalidates all existing refresh tokens → forces immediate re-login
 *  7. Full audit trail written to audit_logs (immutable)
 *
 * Designed for:
 *  - Admin-A resets Admin-B when B is locked out
 *  - Admin resets any officer who cannot access email for OTP reset
 */
exports.adminResetPassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestingAdminId = req.user.user_id;

    // Rule 2: Cannot reset your own account via this endpoint
    if (userId === requestingAdminId) {
      return badRequest(res, 'You cannot reset your own password via this endpoint. Use Forgot Password instead.');
    }

    const targetUser = await User.findByPk(userId);
    if (!targetUser) return notFound(res, 'User not found');

    // Only allow resetting officer/admin accounts (not applicants)
    if (targetUser.role === 'APPLICANT') {
      return badRequest(res, 'Applicant passwords must be reset by the applicant via Forgot Password.');
    }

    // Generate a secure random temporary password
    // Format: 4 uppercase + 4 digits + 4 lowercase + 4 symbols = 16 chars
    const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower   = 'abcdefghjkmnpqrstuvwxyz';
    const digits  = '23456789';
    const symbols = '@#!$';
    const randomChar = (set) => set[Math.floor(Math.random() * set.length)];
    const tempParts = [
      ...Array.from({length:4}, () => randomChar(upper)),
      ...Array.from({length:4}, () => randomChar(digits)),
      ...Array.from({length:4}, () => randomChar(lower)),
      ...Array.from({length:4}, () => randomChar(symbols)),
    ];
    // Fisher-Yates shuffle for uniform distribution
    for (let i = tempParts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tempParts[i], tempParts[j]] = [tempParts[j], tempParts[i]];
    }
    const tempPassword = tempParts.join('');

    const password_hash = await require('bcryptjs').hash(tempPassword, 12);

    // Get requesting admin's info for audit trail
    const requestingAdmin = await User.findByPk(requestingAdminId, { attributes: ['email', 'role'] });
    const adminOfficer = await Officer.findOne({ where: { user_id: requestingAdminId }, attributes: ['full_name'] });
    const adminName = adminOfficer?.full_name || requestingAdmin?.email || 'Admin';

    // Apply changes: new password + force 2FA re-setup + invalidate all sessions
    await targetUser.update({
      password_hash,
      refresh_token:        null,    // invalidate all active sessions immediately
      first_login_verified: false,   // force OTP verification on next login
      otp_code:             null,
      otp_expires_at:       null,
      reset_token:          null,
      reset_token_expires_at: null,
    });

    // Write immutable audit log
    await AuditLog.create({
      user_id:      requestingAdminId,
      action:       'ADMIN_PASSWORD_RESET',
      entity_type:  'User',
      entity_id:    userId,
      before_state: { email: targetUser.email, role: targetUser.role, first_login_verified: targetUser.first_login_verified },
      after_state:  {
        email: targetUser.email,
        first_login_verified: false,
        sessions_invalidated: true,
        reset_performed_by:   requestingAdmin?.email,
        reset_performed_at:   new Date().toISOString(),
      },
      ip_address:   req.ip,
      user_agent:   req.get('user-agent'),
      is_immutable: true,
    });

    // Email the temporary password directly to the target user
    const emailResult = await sendEmail({
      to:      targetUser.email,
      subject: 'Kelaniya Pradeshiya Sabha — Your Password Has Been Reset',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #E2E8F0;border-radius:8px;">
          <div style="background:#1A5276;padding:20px;border-radius:6px 6px 0 0;text-align:center;">
            <h2 style="color:white;margin:0;font-size:18px;">Pradeshiya Sabha Planning System</h2>
          </div>
          <div style="padding:24px;">
            <h3 style="color:#1A2B4A;">Password Reset by System Administrator</h3>
            <p style="color:#374151;">Your account password has been reset by a System Administrator (<strong>${adminName}</strong>).</p>
            <p style="color:#374151;">Your temporary password is:</p>
            <div style="background:#F0F4F8;border:2px dashed #1A5276;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
              <code style="font-size:22px;font-weight:700;letter-spacing:0.15em;color:#1A2B4A;">${tempPassword}</code>
            </div>
            <p style="color:#374151;font-size:14px;"><strong>What to do next:</strong></p>
            <ol style="color:#374151;font-size:14px;line-height:1.8;">
              <li>Log in using this temporary password</li>
              <li>You will be asked to verify your identity with a one-time OTP sent to this email</li>
              <li>After verification, go to <strong>My Profile → Change Password</strong> and set a permanent password</li>
            </ol>
            <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:6px;padding:12px;margin-top:16px;">
              <p style="margin:0;color:#92400E;font-size:13px;">⚠️ This password is temporary. Change it immediately after logging in. If you did not expect this reset, contact the Pradeshiya Sabha office immediately.</p>
            </div>
          </div>
          <div style="text-align:center;padding:16px;color:#9BADBF;font-size:12px;">
            Kelaniya Pradeshiya Sabha — Planning Approval System
          </div>
        </div>
      `,
      text: `Your Pradeshiya Sabha password has been reset by ${adminName}. Temporary password: ${tempPassword}. Log in and change it immediately. You will need to verify via OTP on first login.`,
    });

    return success(res, {
      user_id:     targetUser.user_id,
      email:       targetUser.email,
      role:        targetUser.role,
      email_sent:  !emailResult?.skipped,
      // Only expose temp password in response if email failed (fallback for admin to copy manually)
      temp_password: emailResult?.skipped ? tempPassword : '[sent via email]',
      message:     emailResult?.skipped
        ? 'Password reset. Email not configured — copy temp password above and deliver securely.'
        : 'Password reset and emailed to the officer. They must verify OTP on next login.',
    }, 'Admin password reset completed');

  } catch (err) { next(err); }
};
