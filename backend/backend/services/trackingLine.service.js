/**
 * trackingLine.service.js
 *
 * Fixes in this version:
 *  1. createTrackingLine — first node (SUBMITTED) now stores full application details
 *     and payment info in `metadata` so the applicant can see everything when they
 *     extract that first node from the tracking line.
 *  2. node_type changed from 'REFERENCE_NUMBER' to 'SUBMITTED' so the frontend
 *     icon map renders correctly (📤 instead of ●).
 *  3. Application and Payment models imported to enrich the first node — fetched
 *     non-fatally so a missing payment never blocks tracking line creation.
 */

const { TrackingLine, TrackingNode, Application, Payment, PlanType } = require('../models');

// ── Helper ────────────────────────────────────────────────────────────────────
const isUUID = (str) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new tracking line for an application and seed the first node.
 *
 * The first node contains `metadata` with:
 *   - Reference number
 *   - Plan type and sub-type
 *   - Work type, submission mode, submission date
 *   - Application fee amount, payment status, receipt number
 *   - Professional (architect/engineer) name
 *   - Site area / building area / wall length
 *
 * This means when the applicant clicks "Track Application" → opens the first
 * node → they see all application details and payment confirmation in one place,
 * matching the spec requirement.
 */
const createTrackingLine = async (applicationId, referenceNumber) => {
  // ── Create the tracking line ───────────────────────────────────────────────
  const line = await TrackingLine.create({
    application_id:   applicationId,
    reference_number: referenceNumber,
    overall_status:   'SUBMITTED',
  });

  // ── Fetch application details for the first node metadata ─────────────────
  // Non-fatal: if the lookup fails for any reason we still create the node
  // with minimal data rather than throwing.
  let appDetails  = {};
  let payDetails  = {};

  try {
    const app = await Application.findByPk(applicationId, {
      include: [{ model: PlanType, as: 'PlanType', attributes: ['display_name', 'category', 'subtype'], required: false }],
    });

    if (app) {
      appDetails = {
        reference_number:   referenceNumber,
        plan_type:          app.PlanType?.display_name ?? null,
        plan_category:      app.PlanType?.category     ?? null,
        sub_plan_type:      app.sub_plan_type           ?? null,
        work_type:          app.work_type               ?? null,
        proposed_use:       app.proposed_use            ?? null,
        submission_mode:    app.submission_mode         ?? null,
        submitted_at:       app.submitted_at            ? new Date(app.submitted_at).toISOString() : new Date().toISOString(),
        site_area_perches:  app.site_area               ?? null,
        building_area_sqm:  app.building_area           ?? null,
        wall_length_m:      app.wall_length             ?? null,
        story_type:         app.story_type              ?? null,
        professional_name:  app.professional_name       ?? null,
        professional_reg:   app.professional_reg_number ?? null,
        land_ownership:     app.land_ownership_type     ?? null,
        // Location hint for TO
        place_description:  app.map_place_description   ?? null,
      };
    }
  } catch (appErr) {
    console.error('[TRACKING] Could not fetch app details for first node:', appErr.message);
  }

  try {
    // Get the most recent APPLICATION_FEE payment for this application
    const payment = await Payment.findOne({
      where: {
        application_id: applicationId,
        payment_type:   'APPLICATION_FEE',
      },
      order: [['created_at', 'DESC']],
    });

    // Also try by reference_number in case application_id wasn't stored on payment
    const paymentByRef = !payment && referenceNumber
      ? await Payment.findOne({
          where: { reference_number: referenceNumber, payment_type: 'APPLICATION_FEE' },
          order: [['created_at', 'DESC']],
        })
      : null;

    const p = payment ?? paymentByRef;
    if (p) {
      payDetails = {
        application_fee:   Number(p.amount),
        payment_status:    p.payment_status,
        payment_method:    p.payment_method  ?? null,
        receipt_number:    p.receipt_number  ?? null,
        paid_at:           p.paid_at         ? new Date(p.paid_at).toISOString() : null,
      };
    } else {
      payDetails = {
        application_fee: 200,
        payment_status:  'PENDING',
      };
    }
  } catch (payErr) {
    console.error('[TRACKING] Could not fetch payment for first node:', payErr.message);
    payDetails = { application_fee: 200, payment_status: 'UNKNOWN' };
  }

  // ── Create the first tracking node ────────────────────────────────────────
  // node_type = 'SUBMITTED' maps to 📤 icon in the frontend NODE_ICONS map.
  const node = await TrackingNode.create({
    tracking_line_id:        line.tracking_line_id,
    reference_number:        referenceNumber,
    node_type:               'SUBMITTED',
    label:                   'Application Submitted',
    node_label:              'Application Submitted',
    status:                  'COMPLETED',
    sequence_number:         1,
    sort_order:              1,
    is_visible_to_applicant: true,
    started_at:              new Date(),
    completed_at:            new Date(),
    // All application and payment details packed into metadata
    // The frontend TrackingLine component renders these in the node detail panel
    metadata: {
      ...appDetails,
      ...payDetails,
    },
  });

  await line.update({ current_node_id: node.node_id });
  return { line, node };
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a new node to an existing tracking line.
 */
const addNode = async (
  trackingLineId, referenceNumber, nodeType, nodeLabel,
  linkedData = {}, isAppeal = false, appealRound = null
) => {
  const lastNode = await TrackingNode.findOne({
    where:  { tracking_line_id: trackingLineId },
    order:  [['sequence_number', 'DESC']],
  });
  const seq = (lastNode?.sequence_number || 0) + 1;

  // Nodes visible to applicant by default
  // Internal review nodes are hidden so applicants see progress without sensitive details
  const visibleToApplicant = ![
    'SW_REVIEW','HO_APPROVAL','RDA_APPROVAL','GJS_APPROVAL',
    'PHI_INSPECTION','SW_FINAL','FURTHER_REVIEW','FURTHER_REVIEW_RETURN',
  ].includes(nodeType);

  const node = await TrackingNode.create({
    tracking_line_id:        trackingLineId,
    reference_number:        referenceNumber,
    node_type:               nodeType,
    label:                   nodeLabel,
    node_label:              nodeLabel,
    status:                  'ACTIVE',
    sequence_number:         seq,
    sort_order:              seq,
    is_visible_to_applicant: visibleToApplicant,
    is_appeal_node:          isAppeal,
    appeal_round:            appealRound,
    started_at:              new Date(),
    ...linkedData,
  });

  // Update tracking line current node
  await TrackingLine.update(
    { current_node_id: node.node_id },
    { where: { tracking_line_id: trackingLineId } }
  );

  // Emit real-time tracking update to applicant's socket room
  setImmediate(async () => {
    try {
      const io = require('../utils/socketServer').getIO();
      if (!io || !referenceNumber) return;
      const { Applicant } = require('../models');
      const app = await Application.findOne({
        where:      { reference_number: referenceNumber },
        attributes: ['applicant_id'],
      });
      if (app) {
        const applicant = await Applicant.findByPk(app.applicant_id, { attributes: ['user_id'] });
        if (applicant?.user_id) {
          io.to(`user:${applicant.user_id}`).emit('tracking_update', {
            reference_number: referenceNumber,
            node_type:        nodeType,
            label:            nodeLabel,
          });
          io.to(`user:${applicant.user_id}`).emit('notification', {
            title:            'Application Status Updated',
            body:             `Your application ${referenceNumber} has a new update: ${nodeLabel}`,
            event_type:       'TRACKING_NODE_ADDED',
            reference_number: referenceNumber,
            received_at:      new Date().toISOString(),
          });
        }
      }
    } catch (e) { /* non-critical — socket failure must not affect DB */ }
  });

  return node;
};

// ─────────────────────────────────────────────────────────────────────────────

const getNodeByType = async (trackingLineId, nodeType) => {
  return TrackingNode.findOne({
    where: { tracking_line_id: trackingLineId, node_type: nodeType },
  });
};

const completeNode = async (nodeId) => {
  return TrackingNode.update(
    { status: 'COMPLETED', completed_at: new Date() },
    { where: { node_id: nodeId } }
  );
};

const getFullTrackingLine = async (referenceNumber, forApplicant = false) => {
  const line = await TrackingLine.findOne({ where: { reference_number: referenceNumber } });
  if (!line) return null;

  const where = { tracking_line_id: line.tracking_line_id };
  if (forApplicant) where.is_visible_to_applicant = true;

  const nodes = await TrackingNode.findAll({
    where,
    order: [['sequence_number', 'ASC']],
    // For applicant view, include metadata so the first node detail panel works
    attributes: forApplicant
      ? ['node_id','node_type','label','status','completed_at','started_at',
         'sequence_number','is_appeal_node','appeal_round','metadata','is_visible_to_applicant']
      : undefined,
  });

  return { line, nodes };
};

module.exports = { createTrackingLine, addNode, getNodeByType, completeNode, getFullTrackingLine };