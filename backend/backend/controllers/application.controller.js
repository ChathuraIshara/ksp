const { Application, TrackingLine, AssessmentTaxRecord, Applicant, Officer, TaskAssignment, PlanType, QueueAssignment, Queue, Payment, Complaint, User } = require('../models');
const appService = require('../services/application.service');
const appGate = require('../services/applicationGate.service');
const trackingService = require('../services/trackingLine.service');
const { generateReferenceNumber } = require('../utils/referenceGenerator');
const { daysUntil, isExpired } = require('../utils/dateHelpers');
const { generateReceiptPDF } = require('../utils/pdfGenerator');
const notifEvents = require('../services/notificationEvents.service');
const { success, created, notFound, badRequest, forbidden, error } = require('../utils/responseHelper');
const { Op } = require('sequelize');

const OFFICER_ROLES = ['PSO','SW','TO','PHI','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];
const isOfficer = (role) => OFFICER_ROLES.includes(role);

exports.createApplication = async (req, res, next) => {
  try {
    // Strip injected status/flags — always start as DRAFT
    const { status, requires_ho, requires_rda, requires_gjs, expiry_fine_applied, ...safeBody } = req.body;
    // applicant_id must come from the authenticated JWT — never from the request body
    // The wizard does not know its own applicant_id UUID; it lives in the JWT payload.
    if (!safeBody.applicant_id && req.user.applicant_id) {
      safeBody.applicant_id = req.user.applicant_id;
    }
    if (!safeBody.applicant_id) {
      return badRequest(res, 'applicant_id could not be resolved. Ensure you are logged in as an applicant.');
    }
    const app = await Application.create({ ...safeBody, status: 'DRAFT' });
    await appService.onApplicationCreate(app);
    return created(res, app);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const app = await Application.findOne({ where: { reference_number: req.params.ref } });
    if (!app) return notFound(res);
    // Ownership checked by ownershipGuard middleware on the route; controller is defence-in-depth
    if (!isOfficer(req.user.role) && req.user.applicant_id && app.applicant_id !== req.user.applicant_id) {
      return forbidden(res, 'Access denied');
    }
    return success(res, app);
  } catch (err) { next(err); }
};

exports.getByApplicant = async (req, res, next) => {
  try {
    if (!isOfficer(req.user.role) && req.user.applicant_id !== req.params.applicantId) {
      return forbidden(res, 'Access denied');
    }
    const apps = await Application.findAll({ where: { applicant_id: req.params.applicantId }, order: [['created_at','DESC']] });
    return success(res, apps);
  } catch (err) { next(err); }
};

exports.getByTaxNumber = async (req, res, next) => {
  try {
    const record = await AssessmentTaxRecord.findOne({ where: { tax_number: req.params.taxNumber } });
    if (!record) return notFound(res, 'Tax record not found');
    const apps = await Application.findAll({ where: { tax_record_id: record.tax_record_id } });
    return success(res, apps);
  } catch (err) { next(err); }
};

exports.getByStatus = async (req, res, next) => {
  try {
    const VALID_STATUSES = [
      'DRAFT','PAYMENT_PENDING','SUBMITTED','PSO_REVIEW','VERIFIED',
      'ASSIGNED_TO_SW','ASSIGNED_TO_TO','INSPECTION_SCHEDULED','INSPECTION_DONE',
      'SW_REVIEW','EXTERNAL_APPROVAL','PC_REVIEW','APPROVED','CONDITIONALLY_APPROVED',
      'REJECTED','FURTHER_REVIEW','DEFERRED','APPEAL_PENDING','APPEAL_IN_REVIEW',
      'APPROVAL_FEE_PENDING','CERTIFICATE_READY','COR_PENDING','COR_REVIEW',
      'COR_ISSUED','CLOSED','EXPIRED',
    ];
    if (!VALID_STATUSES.includes(req.params.status)) {
      return badRequest(res, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    const apps = await Application.findAll({
      where: { status: req.params.status },
      limit: 200,
      order: [['created_at', 'DESC']],
    });
    return success(res, apps);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return badRequest(res, 'status is required');
    const app = await Application.findOne({ where: { reference_number: req.params.ref } });
    if (!app) return notFound(res);
    await appService.transition(app.application_id, status, req.user.user_id);
    return success(res, null, `Status updated to ${status}`);
  } catch (err) { next(err); }
};

exports.updateStage = async (req, res, next) => {
  try {
    const { stage } = req.body;
    if (!stage || typeof stage !== 'string' || stage.trim().length === 0) {
      return badRequest(res, 'stage must be a non-empty string');
    }
    const VALID_STAGES = [
      'INTAKE','PSO_REVIEW','SW_REVIEW','TO_INSPECTION','EXTERNAL_REVIEW',
      'PC_REVIEW','APPROVED','REJECTED','COR_REVIEW','CLOSED',
    ];
    if (!VALID_STAGES.includes(stage.trim())) {
      return badRequest(res, `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`);
    }
    await Application.update({ stage: stage.trim() }, { where: { reference_number: req.params.ref } });
    return success(res, null, 'Stage updated');
  } catch (err) { next(err); }
};

exports.generateReferenceNumber = async (req, res, next) => {
  try {
    // :ref param can be either an application_id (UUID) or an existing reference_number
    const { ref } = req.params;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const app = isUUID
      ? await Application.findByPk(ref)
      : await Application.findOne({ where: { reference_number: ref } });
    if (!app) return notFound(res, 'Application not found');
    if (app.reference_number) {
      // Idempotent behavior: if already assigned, return the existing reference
      // instead of failing (prevents duplicate-click / stale-UI errors).
      return success(res, { reference_number: app.reference_number }, 'Reference number already assigned');
    }
    // Get plan type category for type-prefixed reference
    const planType = await PlanType.findByPk(app.plan_type_id);
    const refNum = await generateReferenceNumber(planType?.category);
    await app.update({ reference_number: refNum, status: 'SUBMITTED', submitted_at: new Date() });
    await trackingService.createTrackingLine(app.application_id, refNum);
    await notifEvents.emit('REFERENCE_NUMBER_ISSUED', { referenceNumber: refNum, applicantId: app.applicant_id });
    return success(res, { reference_number: refNum });
  } catch (err) { next(err); }
};

exports.generateAndSaveRefReceipt = async (req, res, next) => {
  try {
    const app = await Application.findOne({ where: { reference_number: req.params.ref } });
    if (!app) return notFound(res);
    const filename = `receipt_${app.reference_number}_${Date.now()}.pdf`;
    const filePath = await generateReceiptPDF({ reference_number: app.reference_number, submitted_at: app.submitted_at, status: app.status }, filename);
    await app.update({ ref_receipt_path: filePath });
    return success(res, { receipt_path: filePath }, 'Receipt generated and saved');
  } catch (err) { next(err); }
};

exports.forwardToSW = async (req, res, next) => {
  try {
    const app = await Application.findOne({ where: { reference_number: req.params.ref } });
    if (!app) return notFound(res);
    await appService.transition(app.application_id, 'ASSIGNED_TO_SW', req.user.user_id);
    return success(res, null, 'Forwarded to SW queue');
  } catch (err) { next(err); }
};

exports.checkExpiryStatus = async (req, res, next) => {
  try {
    const app = await Application.findOne({ where: { reference_number: req.params.ref } });
    if (!app) return notFound(res);
    const expired = app.approval_expiry_date ? isExpired(app.approval_expiry_date) : null;
    const days = app.approval_expiry_date ? daysUntil(app.approval_expiry_date) : null;
    return success(res, { expired, daysRemaining: days, expiry_date: app.approval_expiry_date });
  } catch (err) { next(err); }
};

exports.sendExpiryReminder = async (req, res, next) => {
  try {
    const app = await Application.findOne({ where: { reference_number: req.params.ref } });
    if (!app) return notFound(res);
    // Resolve applicant user_id for notification dispatch
    const applicant = await Applicant.findByPk(app.applicant_id, { attributes: ['user_id'] });
    const userId = applicant?.user_id;
    if (!userId) return badRequest(res, 'Could not resolve applicant user ID');
    await notifEvents.emit('EXPIRY_REMINDER_MANUAL', { referenceNumber: app.reference_number, applicantId: userId });
    return success(res, null, 'Expiry reminder sent to applicant');
  } catch (err) { next(err); }
};

exports.applyLateFine = async (req, res, next) => {
  try {
    await Application.update({ expiry_fine_applied: true }, { where: { reference_number: req.params.ref } });
    return success(res, null, 'Late fine flag applied');
  } catch (err) { next(err); }
};

exports.setRejectionReason = async (req, res, next) => {
  try {
    if (!req.body.reason) return badRequest(res, 'reason is required');
    await Application.update({ rejection_reason: req.body.reason }, { where: { reference_number: req.params.ref } });
    return success(res, null, 'Rejection reason set');
  } catch (err) { next(err); }
};

exports.checkPaymentClearance = async (req, res, next) => {
  try {
    const { paymentType } = req.query;
    const result = await appGate.checkAllClear(req.params.ref, paymentType || 'APPROVAL_FEE');
    return success(res, result);
  } catch (err) { next(err); }
};

exports.getApplicationsWithFlags = async (req, res, next) => {
  try {
    const apps = await Application.findAll({ where: { status: { [Op.in]: ['ASSIGNED_TO_SW','ASSIGNED_TO_TO','SW_REVIEW'] } } });
    const withFlags = apps.map(a => ({
      ...a.toJSON(),
      warning_flags: {
        industrial: a.requires_ho,
        near_rda_road: a.requires_rda,
        questionable_soil: a.requires_gjs,
      },
    }));
    return success(res, withFlags);
  } catch (err) { next(err); }
};

// GET /applications/my — returns the calling applicant's own applications
exports.myApplications = async (req, res, next) => {
  try {
    if (req.user.role !== 'APPLICANT') {
      return forbidden(res, 'Only applicants can use this endpoint');
    }
    const applicant = await Applicant.findOne({ where: { user_id: req.user.user_id } });
    if (!applicant) return notFound(res, 'Applicant profile not found');

    // PlanType, QueueAssignment, Queue, Payment already imported at top

    const apps = await Application.findAll({
      where: { applicant_id: applicant.applicant_id },
      order: [['created_at', 'DESC']],
      include: [
        { model: PlanType, as: 'PlanType', attributes: ['display_name','category','subtype'], required: false },
        {
          model: QueueAssignment, required: false,
          include: [{ model: Queue, attributes: ['queue_type'], required: false }],
        },
      ],
    });

    // Enrich with queue info and document issue flag
    const enriched = await Promise.all(apps.map(async (app) => {
      const plain = app.toJSON();
      const activeQA = plain.QueueAssignments?.find((qa) => qa.status === 'ACTIVE' || qa.status === 'PENDING');
      plain.queue_type = activeQA?.Queue?.queue_type ?? null;
      plain.has_document_issue_notification = plain.queue_type === 'DOCUMENT_ISSUE';

      // Get pending payment amount if applicable
      if (['PAYMENT_PENDING','APPROVAL_FEE_PENDING'].includes(plain.status)) {
        const pendingPayments = await Payment.findAll({
          where: { application_id: plain.application_id, payment_status: 'PENDING' },
          attributes: ['amount'],
        });
        plain.pending_amount = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0) || 200;
      }

      return plain;
    }));

    return success(res, enriched);
  } catch (err) { next(err); }
};

// GET /applications/pso/queue — applications awaiting PSO review, with queue_type and complaint flags
exports.getPSOQueue = async (req, res, next) => {
  try {
    const { queue_type, page = 1, limit = 50 } = req.query;
    const pageSize = Math.min(parseInt(limit) || 50, 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * pageSize;
    const where = { status: ['SUBMITTED', 'PSO_REVIEW', 'VERIFIED', 'ASSIGNED_TO_SW'] };
    const { count, rows } = await Application.findAndCountAll({
      where,
      order: [['submitted_at', 'ASC']],
      limit: pageSize,
      offset,
      include: [
        { model: Applicant, attributes: ['full_name', 'nic_number', 'phone'], required: false },
        { model: QueueAssignment, required: false,
          include: [{ model: Queue, attributes: ['queue_type', 'display_name'], required: false }] },
      ],
    });

    // Enrich each application with queue_type and complaint flag
    // Complaint already imported at top
    const enriched = await Promise.all(rows.map(async (app) => {
      const plain = app.toJSON();
      // Get active queue assignment type
      const activeQA = plain.QueueAssignments?.find((qa) => qa.status === 'ACTIVE' || qa.status === 'PENDING');
      plain.queue_type = activeQA?.Queue?.queue_type ?? null;

      // Auto-detect: check for active complaints on this application's tax number
      if (plain.tax_number) {
        const complaintCount = await Complaint.count({
          where: { tax_number: plain.tax_number, status: ['PENDING', 'IN_REVIEW'] }
        });
        plain.has_complaint = complaintCount > 0;
      }

      // Auto-detect: name mismatch between applicant name and tax record owner
      // System checks this automatically so PSO sees the flag without manual lookup
      plain.has_name_mismatch = false;
      if (plain.tax_number && plain.Applicant?.full_name) {
        try {
          const { AssessmentTaxRecord, TaxRecordOwner } = require('../models');
          const taxRecord = await AssessmentTaxRecord.findOne({
            where: { tax_number: plain.tax_number, is_active: true },
            include: [{ model: TaxRecordOwner, where: { is_active: true }, required: false }],
          });
          if (taxRecord && taxRecord.TaxRecordOwners?.length > 0) {
            const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '');
            const applicantNorm = normalize(plain.Applicant.full_name);
            const matched = taxRecord.TaxRecordOwners.some(
              (o) => normalize(o.owner_name) === applicantNorm
            );
            plain.has_name_mismatch = !matched;
            // Store matched owner name for PSO to see the discrepancy
            if (!matched) {
              plain.tax_record_owner_name = taxRecord.TaxRecordOwners[0]?.owner_name ?? null;
            }
          } else if (taxRecord && (!taxRecord.TaxRecordOwners || taxRecord.TaxRecordOwners.length === 0)) {
            // Tax record exists but no owner on file — flag as pending rather than mismatch
            plain.has_name_mismatch = false;
            plain.tax_record_owner_name = null;
          }
        } catch (e) {
          // Non-fatal — flag stays false if lookup fails
          console.error('[PSO QUEUE] Name mismatch check error:', e.message);
        }
      }

      return plain;
    }));

    // Filter by queue_type if specified
    const filtered = queue_type
      ? enriched.filter((a) => a.queue_type === queue_type)
      : enriched;

    return success(res, { total: count, page: parseInt(page) || 1, limit: pageSize, data: filtered });
  } catch (err) { next(err); }
};

// GET /applications/sw/assigned — applications assigned to the calling SW
exports.getSWAssigned = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageSize = Math.min(parseInt(limit) || 50, 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * pageSize;
    const officer = await Officer.findOne({ where: { user_id: req.user.user_id } });
    if (!officer) return notFound(res, 'Officer profile not found');
    const { count, rows } = await TaskAssignment.findAndCountAll({
      where: { assigned_to: officer.officer_id, task_type: 'SW_REVIEW', status: ['PENDING','IN_PROGRESS'] },
      include: [{ model: Application }],
      limit: pageSize,
      offset,
    });
    const apps = rows.map(t => t.Application).filter(Boolean);
    return success(res, { total: count, page: parseInt(page) || 1, limit: pageSize, data: apps });
  } catch (err) { next(err); }
};

// GET /applications/to/assigned — applications assigned to the calling TO
exports.getTOAssigned = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageSize = Math.min(parseInt(limit) || 50, 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * pageSize;
    const officer = await Officer.findOne({ where: { user_id: req.user.user_id } });
    if (!officer) return notFound(res, 'Officer profile not found');
    const { count, rows } = await TaskAssignment.findAndCountAll({
      where: { assigned_to: officer.officer_id, task_type: ['TO_INSPECTION','SUPPLEMENTARY_INSPECTION'], status: ['PENDING','IN_PROGRESS'] },
      include: [{ model: Application }],
      limit: pageSize,
      offset,
    });
    const apps = rows.map(t => t.Application).filter(Boolean);
    return success(res, { total: count, page: parseInt(page) || 1, limit: pageSize, data: apps });
  } catch (err) { next(err); }
};

// GET /applications/search — search by reference_number, status, submission_mode
exports.search = async (req, res, next) => {
  try {
    const { ref, status, plan_type_id, tax_number, submission_mode, limit = 50 } = req.query;
    const where = {};
    if (ref)             { const safeRef = ref.replace(/%/g,'\\%').replace(/_/g,'\\_'); where.reference_number = { [Op.like]: `%${safeRef}%` }; }
    if (status)          where.status = status;
    if (plan_type_id)    where.plan_type_id = plan_type_id;
    if (submission_mode) where.submission_mode = submission_mode;

    if (tax_number) {
      const safeTax = tax_number.replace(/%/g,'\\%').replace(/_/g,'\\_');
      const taxRec = await AssessmentTaxRecord.findOne({ where: { tax_number: { [Op.like]: `%${safeTax}%` } } });
      if (taxRec) where.tax_record_id = taxRec.tax_record_id;
      else return success(res, []);
    }

    const apps = await Application.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(parseInt(limit) || 50, 200),
    });
    return success(res, apps);
  } catch (err) { next(err); }
};

// POST /applications/:applicationId/sw-review-submit
// Thin alias kept for API-layer completeness.
// The real logic runs server-side: POST /minutes/:id/submit triggers
// swWorkflowService.onSWReviewSubmit when minute_type is SW_*_REVIEW.
// This endpoint simply validates the application exists and returns its current state.
exports.swReviewSubmit = async (req, res, next) => {
  try {
    const app = await Application.findByPk(req.params.applicationId);
    if (!app) return notFound(res, 'Application not found');
    return success(res, { application_id: app.application_id, status: app.status }, 'SW review noted — state managed via minute submit');
  } catch (err) { next(err); }
};

exports.listAll = async (req, res, next) => {
  try {
    const { Application } = require('../models');
    const { Op } = require('sequelize');
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.from) where.created_at = { [Op.gte]: new Date(req.query.from) };
    // ?role=UDA → only applications that need UDA review (PC_REVIEW stage or later)
    if (req.query.role === 'UDA') {
      where.status = { [Op.in]: ['PC_REVIEW','PENDING_DECISION','CONDITIONALLY_APPROVED','APPROVED'] };
    }
    const apps = await Application.findAll({ where, order: [['created_at','DESC']], limit: parseInt(req.query.limit)||200 });
    return require('../utils/responseHelper').success(res, apps);
  } catch (err) { require('../utils/responseHelper').error(res, err.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /applications/walk-in  (PSO/ADMIN only)
//
// Walk-in / Counter submission flow:
//  1. PSO enters applicant details at counter (no account needed)
//  2. PSO enters all application details
//  3. PSO uploads the payment receipt issued at the counter cashier
//  4. PSO uploads digital copies of the 3 physical plan documents
//  5. Application is created with submission_mode = 'WALK_IN'
//  6. Application flows to SW queue same as online — no PSO verification queue
//     (PSO has already physically verified at counter)
//
// Body: { applicant_name, applicant_nic, applicant_phone, applicant_address,
//         plan_type_id, tax_number, ...application fields,
//         payment_receipt_number, payment_amount, physical_copies_confirmed: true }
// ─────────────────────────────────────────────────────────────────────────────
exports.createWalkInApplication = async (req, res, next) => {
  try {
    const { Application, Applicant, User, Payment, TrackingLine } = require('../models');
    const { badRequest, created, error: errResp } = require('../utils/responseHelper');
    const { generateReferenceNumber } = require('../utils/referenceGenerator');

    const {
      applicant_name, applicant_nic, applicant_phone, applicant_address,
      plan_type_id, tax_number, tax_record_id,
      payment_receipt_number, payment_amount,
      physical_copies_confirmed,
      ...appFields
    } = req.body;

    // Enforce: PSO must confirm 3 physical copies are present
    if (!physical_copies_confirmed) {
      return badRequest(res, 'physical_copies_confirmed is required. PSO must confirm all 3 physical plan copies are present before registering a walk-in application.');
    }

    if (!payment_receipt_number || !payment_amount) {
      return badRequest(res, 'payment_receipt_number and payment_amount are required for walk-in applications (payment collected at counter).');
    }

    if (!applicant_name || !applicant_nic) {
      return badRequest(res, 'applicant_name and applicant_nic are required for walk-in registration.');
    }

    // Create a system applicant record for walk-in (no User account created)
    // The applicant_id is used only for reference — no login capability
    const [applicantRecord] = await Applicant.findOrCreate({
      where: { nic_number: applicant_nic },
      defaults: {
        full_name: applicant_name,
        nic_number: applicant_nic,
        phone: applicant_phone || null,
        address: applicant_address || null,
        user_id: null, // walk-in — no system account
      },
    });

    // Generate reference number immediately (PSO verified at counter)
    const reference_number = await generateReferenceNumber(appFields.plan_type_category || 'BUILDING_PLAN');

    // Transaction: Application + Payment must both succeed
    const sequelizeDb = require('../config/database');
    let application;

    // Resolve tax_record_id from tax_number if not provided
    // The model has allowNull: false — we must find or create the record
    let resolvedTaxRecordId = tax_record_id || null;
    if (!resolvedTaxRecordId && tax_number) {
      const { AssessmentTaxRecord } = require('../models');
      const taxRec = await AssessmentTaxRecord.findOne({ where: { tax_number } });
      resolvedTaxRecordId = taxRec?.tax_record_id || null;
    }
    if (!resolvedTaxRecordId) {
      return badRequest(res, 'tax_number could not be resolved to a tax record. Verify the assessment tax number is correct.');
    }

    await sequelizeDb.transaction(async (t) => {

    // Create application with WALK_IN mode — skip PSO verification queue
    application = await Application.create({
      ...appFields,
      applicant_id:   applicantRecord.applicant_id,
      plan_type_id,
      tax_record_id:  resolvedTaxRecordId,
      tax_number,
      submission_mode: 'WALK_IN',
      status:          'ASSIGNED_TO_SW', // bypass PSO queue — PSO already verified
      reference_number,
      registered_by:   req.user.user_id, // PSO who registered
      physical_copies_count: 3,
      physical_copies_confirmed: true,
      physical_copies_confirmed_by: req.user.user_id,
    });

    // Record payment collected at counter
    await Payment.create({
      application_id:   application.application_id,
      reference_number,
      payment_type:     'APPLICATION_FEE',
      payment_method:   'COUNTER_CASH',
      amount:           payment_amount,
      receipt_number:   payment_receipt_number,
      payment_status:   'PAID',
      verified_by:      req.user.user_id,
      verified_at:      new Date(),
      notes:            'Collected at Pradeshiya Sabha counter — walk-in registration',
    }, { transaction: t });
    }); // end transaction

    // Create tracking line
    const trackingLineService = require('../services/trackingLine.service');
    const { line: walkInLine } = await trackingLineService.createTrackingLine(application.application_id, reference_number);
    const walkInLineId = walkInLine?.tracking_line_id || walkInLine?.id;
    await trackingLineService.addNode(walkInLineId, reference_number, 'SUBMITTED', 'Walk-in application registered at counter by PSO');
    await trackingLineService.addNode(walkInLineId, reference_number, 'PAYMENT_VERIFIED', 'Payment collected at counter — Rs.' + payment_amount);
    await trackingLineService.addNode(walkInLineId, reference_number, 'PSO_VERIFIED', 'Physical documents and 3 plan copies verified at counter');

    return created(res, {
      application,
      reference_number,
      applicant: applicantRecord,
      message: 'Walk-in application registered. Application forwarded directly to SW queue.',
    });
  } catch (err) { require('../utils/responseHelper').error(res, err.message); }
};

// PUT /applications/:ref/pso-edit
// PDF: PSO can edit application details only when application is in NAME_MISMATCH queue.
// Only safe non-sensitive fields are allowed. Ownership/status/flags are blocked.
// After edit, the application is automatically moved to VERIFIED and escalated to SW.
exports.psoEditApplication = async (req, res, next) => {
  try {
    const app = await Application.findOne({ where: { reference_number: req.params.ref } });
    if (!app) return notFound(res, 'Application not found');

    // Verify application is in a PSO-editable state (NAME_MISMATCH queue)
    const { QueueAssignment, Queue } = require('../models');
    const activeQueue = await QueueAssignment.findOne({
      where: { application_id: app.application_id, status: 'ACTIVE' },
      include: [{ model: Queue, where: { queue_type: 'NAME_MISMATCH' }, required: true }],
    });
    if (!activeQueue) {
      return forbidden(res, 'Application can only be edited by PSO when it is in the Name Mismatch queue');
    }

    // Whitelist: only applicant-identity and land-address fields
    const ALLOWED_PSO_EDIT_FIELDS = [
      'professional_name','professional_designation','professional_address','professional_phone',
      'professional_reg_number',
      'owner_consent_name','owner_consent_address','owner_consent_phone',
      'construction_description','land_ownership_type','land_ownership_notes',
    ];
    const safe = {};
    for (const key of ALLOWED_PSO_EDIT_FIELDS) {
      if (req.body[key] !== undefined) safe[key] = req.body[key];
    }

    await app.update(safe);

    // Spec: after PSO resolves name mismatch by editing, application moves out of the
    // NAME_MISMATCH queue and is auto-escalated to SW (same as VERIFIED path).
    // Mark the queue assignment as RESOLVED and transition application to ASSIGNED_TO_SW.
    setImmediate(async () => {
      try {
        const appService        = require('../services/application.service');
        const trackingLineService = require('../services/trackingLine.service');
        const notifService      = require('../services/notification.service');
        const { TrackingLine, User, Applicant } = require('../models');

        // Supersede the NAME_MISMATCH queue assignment
        await QueueAssignment.update(
          { status: 'RESOLVED' },
          { where: { application_id: app.application_id, status: 'ACTIVE' } }
        );

        // Generate reference number if not yet assigned
        let refNumber = app.reference_number;
        if (!refNumber) {
          const { generateReferenceNumber } = require('../utils/referenceGenerator');
          refNumber = await generateReferenceNumber(app.plan_type_id);
          await app.update({ reference_number: refNumber });
        }

        // Transition status to ASSIGNED_TO_SW
        await appService.transition(app.application_id, 'ASSIGNED_TO_SW', req.user.user_id);

        // Add tracking node
        const line = await TrackingLine.findOne({ where: { reference_number: refNumber } });
        if (line) {
          await trackingLineService.addNode(
            line.tracking_line_id, refNumber,
            'PSO_VERIFIED',
            'Name mismatch resolved by PSO — escalated to SW'
          );
        }

        // Notify applicant that mismatch is resolved
        const applicant = await Applicant.findByPk(app.applicant_id, { attributes: ['user_id'] });
        if (applicant?.user_id) {
          await notifService.dispatch({
            recipient_id:     applicant.user_id,
            event_type:       'NAME_MISMATCH_RESOLVED',
            title:            'Name Mismatch Resolved',
            body:             `The name mismatch on your application (${refNumber}) has been resolved by the PSO. Your application has been forwarded for review.`,
            reference_number: refNumber,
          }).catch(() => {});
        }

        // Notify SW
        const swList = await User.findAll({ where: { role: 'SW', status: 'ACTIVE' }, attributes: ['user_id'], limit: 1 });
        if (swList.length) {
          await notifService.dispatch({
            recipient_id:     swList[0].user_id,
            event_type:       'APPLICATION_ESCALATED',
            title:            'Application Escalated — Name Mismatch Resolved',
            body:             `Application ${refNumber} has had its name mismatch resolved and is now awaiting TO assignment.`,
            reference_number: refNumber,
          }).catch(() => {});
        }
      } catch (e) {
        console.error('[PSO EDIT] Auto-escalation after name mismatch error:', e.message);
      }
    });

    return success(res, app, 'Application updated by PSO. Name mismatch resolved — escalating to SW.');
  } catch (err) { next(err); }
};
