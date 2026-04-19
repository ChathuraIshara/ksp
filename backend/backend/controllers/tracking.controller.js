/**
 * tracking.controller.js
 *
 * Fixes in this version:
 *  1. getAppByRefOrId() — all endpoints now accept EITHER a real reference_number
 *     (e.g. "PS-2025-BP-00123") OR an application_id (UUID). This is required
 *     because DRAFT apps have no reference_number yet — the applicant only has
 *     their application_id. Without this fix every tracking call for a newly
 *     submitted (unpaid) application returns 404 → "No tracking data available".
 *
 *  2. displayForApplicant — now returns metadata and all timestamp fields so the
 *     frontend node detail panel can show application details from the first node.
 *
 *  3. getByRef — same dual-lookup fix for officer views.
 */

const { TrackingLine, TrackingNode, Application } = require('../models');
const trackingLineService = require('../services/trackingLine.service');
const { success, created, badRequest, notFound } = require('../utils/responseHelper');

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve an Application row from either a reference_number or an application_id (UUID).
 *
 * This is needed because:
 *  - After PSO assigns a ref: callers pass the reference_number.
 *  - Before PSO assigns a ref (DRAFT/PAYMENT_PENDING): the frontend only has
 *    the application_id UUID, and falls back to passing that.
 *
 * We check UUID format first to avoid a full-table scan on the reference_number index
 * for UUIDs that will never match.
 */
const getAppByRefOrId = async (ref) => {
  if (!ref) return null;
  if (UUID_REGEX.test(ref)) {
    // Try as primary key (application_id) first — fastest path for DRAFT apps
    const appById = await Application.findByPk(ref);
    if (appById) return appById;
  }
  // Fall back to reference_number lookup (normal path for submitted apps)
  return Application.findOne({ where: { reference_number: ref } });
};

/** Legacy helper kept for internal callers that already know they have a real ref */
const getApp  = async (ref) => Application.findOne({ where: { reference_number: ref } });
const getLine = async (applicationId) => TrackingLine.findOne({ where: { application_id: applicationId } });

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /tracking/public/:ref  — unauthenticated
 * Public tracking view: applicant-visible nodes only, no officer detail.
 * Used by the public /track page (unauthenticated).
 */
exports.getPublicTracking = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const line = await TrackingLine.findOne({ where: { application_id: app.application_id } });
    if (!line) return notFound(res, 'Tracking line not found');

    const nodes = await TrackingNode.findAll({
      where: { tracking_line_id: line.tracking_line_id, is_visible_to_applicant: true },
      order: [['sequence_number', 'ASC']],
      attributes: ['node_id','node_type','label','status','completed_at','started_at','sequence_number','metadata'],
    });

    return success(res, {
      reference_number: app.reference_number ?? req.params.ref,
      current_status:   app.status,
      nodes,
    });
  } catch (err) { next(err); }
};

/**
 * GET /tracking/ref/:ref  — authenticated, any role
 * Full tracking line with all nodes. Used by officers.
 * Also used by the frontend trackingApi.getByRef() call.
 * Accepts both reference_number and application_id.
 */
exports.getByRef = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const line = await TrackingLine.findOne({
      where:   { application_id: app.application_id },
      include: [{ model: TrackingNode, as: 'nodes', order: [['sequence_number', 'ASC']] }],
    });
    if (!line) return notFound(res, 'Tracking line not found');

    return success(res, line);
  } catch (err) { next(err); }
};

exports.getTrackingHistory = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const nodes = await TrackingNode.findAll({
      include: [{
        model:    TrackingLine,
        as:       'trackingLine',
        where:    { application_id: app.application_id },
        required: true,
      }],
      order: [['sequence_number', 'ASC']],
    });
    return success(res, nodes);
  } catch (err) { next(err); }
};

exports.getNodeById = async (req, res, next) => {
  try {
    const node = await TrackingNode.findByPk(req.params.nodeId);
    if (!node) return notFound(res, 'Node not found');
    return success(res, node);
  } catch (err) { next(err); }
};

/**
 * GET /tracking/ref/:ref/applicant-view  — authenticated APPLICANT
 * Returns only is_visible_to_applicant=true nodes WITH full metadata so the
 * node detail panel in the frontend shows application + payment details.
 *
 * Accepts both reference_number and application_id (UUID) — critical for
 * DRAFT apps that have no reference_number yet.
 */
exports.displayForApplicant = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const line = await TrackingLine.findOne({ where: { application_id: app.application_id } });
    if (!line) return notFound(res, 'Tracking line not found');

    const nodes = await TrackingNode.findAll({
      where: { tracking_line_id: line.tracking_line_id, is_visible_to_applicant: true },
      order: [['sequence_number', 'ASC']],
      // Include metadata and timestamp fields so the frontend node detail panel works
      attributes: [
        'node_id','node_type','label','status',
        'completed_at','started_at',         // both timestamps — frontend picks whichever exists
        'sequence_number','metadata',         // metadata = application + payment details on first node
        'is_visible_to_applicant',
        'is_appeal_node','appeal_round',
      ],
    });

    return success(res, {
      reference_number: app.reference_number ?? req.params.ref,
      application_id:   app.application_id,
      current_status:   app.status,
      nodes,
    });
  } catch (err) { next(err); }
};

/**
 * GET /tracking/ref/:ref/officer  (and /:ref/officer-view)
 * Full tracking line for officer views — all nodes including hidden ones.
 */
exports.displayForOfficer = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const line = await TrackingLine.findOne({
      where:   { application_id: app.application_id },
      include: [{ model: TrackingNode, as: 'nodes', order: [['sequence_number', 'ASC']] }],
    });
    if (!line) return notFound(res, 'Tracking line not found');

    return success(res, line);
  } catch (err) { next(err); }
};

exports.updateCurrentNode = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    await TrackingLine.update(
      { current_node_id: req.body.node_id },
      { where: { application_id: app.application_id } }
    );
    return success(res, null, 'Current node updated');
  } catch (err) { next(err); }
};

exports.createFurtherReviewNode = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const line = await getLine(app.application_id);
    if (!line) return notFound(res, 'Tracking line not found');

    const nodeCount = await TrackingNode.count({ where: { tracking_line_id: line.tracking_line_id } });
    const node = await TrackingNode.create({
      tracking_line_id:        line.tracking_line_id,
      reference_number:        app.reference_number,
      node_type:               'FURTHER_REVIEW',
      label:                   `Further Review — Round ${req.body.round || 1}`,
      status:                  'IN_PROGRESS',
      sequence_number:         nodeCount + 1,
      is_visible_to_applicant: false,
      metadata:                req.body.requirements || null,
    });
    return created(res, node, 'Further review node created');
  } catch (err) { next(err); }
};

exports.getNodesByType = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const line = await getLine(app.application_id);
    if (!line) return notFound(res, 'Tracking line not found');

    const nodes = await TrackingNode.findAll({
      where: { tracking_line_id: line.tracking_line_id, node_type: req.params.nodeType },
      order: [['sequence_number', 'ASC']],
    });
    return success(res, nodes);
  } catch (err) { next(err); }
};

exports.getAppealNodes = async (req, res, next) => {
  try {
    const app = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const line = await getLine(app.application_id);
    if (!line) return notFound(res, 'Tracking line not found');

    const nodes = await TrackingNode.findAll({
      where: { tracking_line_id: line.tracking_line_id, node_type: 'APPEAL' },
      order: [['sequence_number', 'ASC']],
    });
    return success(res, nodes);
  } catch (err) { next(err); }
};

/**
 * PUT /tracking/:ref/nodes/:nodeId/visibility
 * Officers toggle whether a node's content is visible to the applicant.
 */
exports.setNodeVisibility = async (req, res, next) => {
  try {
    const { is_visible_to_applicant } = req.body;
    if (is_visible_to_applicant === undefined) {
      return badRequest(res, 'is_visible_to_applicant (true/false) is required');
    }

    const app  = await getAppByRefOrId(req.params.ref);
    if (!app) return notFound(res, 'Application not found');

    const line = await getLine(app.application_id);
    if (!line) return notFound(res, 'Tracking line not found');

    const node = await TrackingNode.findOne({
      where: { node_id: req.params.nodeId, tracking_line_id: line.tracking_line_id },
    });
    if (!node) return notFound(res, 'Node not found');

    await node.update({ is_visible_to_applicant: !!is_visible_to_applicant });
    return success(res, {
      node_id:                  node.node_id,
      is_visible_to_applicant:  node.is_visible_to_applicant,
    }, 'Node visibility updated');
  } catch (err) { next(err); }
};

/**
 * GET /tracking/public/tax/:taxNumber  — public, no auth
 * Returns all applications for an assessment tax number with applicant-visible nodes.
 */
exports.getPublicTrackingByTax = async (req, res, next) => {
  try {
    const { AssessmentTaxRecord } = require('../models');

    const taxRecord = await AssessmentTaxRecord.findOne({
      where: { tax_number: req.params.taxNumber },
    });
    if (!taxRecord) return notFound(res, 'No record found for this assessment tax number');

    const apps = await Application.findAll({
      where:      { tax_record_id: taxRecord.tax_record_id },
      attributes: ['application_id','reference_number','status','submitted_at','sub_plan_type','proposed_use'],
      order:      [['submitted_at', 'DESC']],
      limit:      10,
    });
    if (!apps.length) return notFound(res, 'No applications found for this assessment tax number');

    const results = await Promise.all(apps.map(async (app) => {
      const line = await TrackingLine.findOne({ where: { application_id: app.application_id } });
      if (!line) return { ...app.toJSON(), nodes: [] };
      const nodes = await TrackingNode.findAll({
        where:      { tracking_line_id: line.tracking_line_id, is_visible_to_applicant: true },
        order:      [['sequence_number', 'ASC']],
        attributes: ['node_id','node_type','label','status','completed_at','started_at','sequence_number','metadata'],
      });
      return { ...app.toJSON(), nodes };
    }));

    return success(res, results);
  } catch (err) { next(err); }
};