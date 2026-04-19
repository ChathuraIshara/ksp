const { Application, ExternalApproval, TrackingLine } = require('../models');
const externalApprovalService = require('./externalApproval.service');
const applicationService      = require('./application.service');
const trackingLineService     = require('./trackingLine.service');

const onSWReviewSubmit = async (minuteId, applicationId, referenceNumber, submittedBy) => {
  const app = await Application.findByPk(applicationId);
  if (!app) throw new Error('Application not found');

  // Determine which external approvals are needed based on plan type flags
  const flags = await applicationService.computeExternalApprovalFlags(applicationId);

  await app.update({
    requires_ho:  flags.requires_ho,
    requires_rda: flags.requires_rda,
    requires_gjs: flags.requires_gjs,
  });

  const needsExternal = flags.requires_ho || flags.requires_rda || flags.requires_gjs;

  if (needsExternal) {
    // Create ExternalApproval DB records for each agency
    await externalApprovalService.createExternalApprovals(applicationId, referenceNumber, flags, submittedBy);
    await applicationService.transition(applicationId, 'EXTERNAL_APPROVAL', submittedBy);

    const line = await TrackingLine.findOne({ where: { reference_number: referenceNumber } });
    if (line) {
      // HO and GJS nodes: created immediately
      if (flags.requires_ho)  await trackingLineService.addNode(line.tracking_line_id, referenceNumber, 'HO_APPROVAL',  'Health Officer Assessment');
      if (flags.requires_gjs) await trackingLineService.addNode(line.tracking_line_id, referenceNumber, 'GJS_APPROVAL', 'GJS Land Assessment');

      // ── RDA GATE ────────────────────────────────────────────────────────────
      // Per spec: "The RDA node will NOT be created in the tracking line until
      // the signed waiver PDF is uploaded." We do NOT create the node here.
      // The node is created lazily by addRDANodeAfterWaiverUpload() below,
      // which the externalApproval controller calls after waiver upload succeeds.
      // ────────────────────────────────────────────────────────────────────────
    }
  } else {
    await applicationService.transition(applicationId, 'PC_REVIEW', submittedBy);
  }

  return { flags, needsExternal };
};

// Called by externalApproval controller after RDA waiver PDF is successfully uploaded.
// Creates the RDA tracking node — only now, not before.
const addRDANodeAfterWaiverUpload = async (referenceNumber) => {
  const line = await TrackingLine.findOne({ where: { reference_number: referenceNumber } });
  if (!line) throw new Error('Tracking line not found for ' + referenceNumber);

  // Idempotent: don't add a second RDA node if called again
  const existing = await trackingLineService.getNodeByType(line.tracking_line_id, 'RDA_APPROVAL');
  if (existing) return existing;

  return trackingLineService.addNode(line.tracking_line_id, referenceNumber, 'RDA_APPROVAL', 'RDA Approval');
};

module.exports = { onSWReviewSubmit, addRDANodeAfterWaiverUpload };
