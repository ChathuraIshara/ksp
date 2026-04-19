const { Application, TrackingLine, TrackingNode } = require('../models');
const trackingLineService = require('./trackingLine.service');

/**
 * Application status state machine.
 * Every status change goes through transition() which enforces valid paths.
 * Admin/PSO can use the override endpoint to force a status change if needed.
 */
const TRANSITIONS = {
  DRAFT:                    ['PAYMENT_PENDING', 'SUBMITTED'],
  PAYMENT_PENDING:          ['SUBMITTED', 'DRAFT'],
  SUBMITTED:                ['PSO_REVIEW'],
  PSO_REVIEW:               ['VERIFIED', 'DRAFT', 'SUBMITTED'],
  VERIFIED:                 ['ASSIGNED_TO_SW'],
  ASSIGNED_TO_SW:           ['ASSIGNED_TO_TO', 'SW_REVIEW'],
  ASSIGNED_TO_TO:           ['INSPECTION_SCHEDULED'],
  INSPECTION_SCHEDULED:     ['INSPECTION_DONE', 'INSPECTION_SCHEDULED'],
  INSPECTION_DONE:          ['SW_REVIEW'],
  SW_REVIEW:                ['EXTERNAL_APPROVAL', 'PC_REVIEW'],
  EXTERNAL_APPROVAL:        ['PC_REVIEW', 'SW_REVIEW'],
  PC_REVIEW:                ['EXTERNAL_APPROVAL', 'APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'FURTHER_REVIEW', 'DEFERRED'],
  APPROVED:                 ['APPROVAL_FEE_PENDING', 'CERTIFICATE_READY'],
  CONDITIONALLY_APPROVED:   ['APPROVAL_FEE_PENDING', 'CERTIFICATE_READY'],
  APPROVAL_FEE_PENDING:     ['CERTIFICATE_READY'],
  CERTIFICATE_READY:        ['COR_PENDING'],
  REJECTED:                 ['APPEAL_PENDING'],
  APPEAL_PENDING:           ['APPEAL_IN_REVIEW'],
  APPEAL_IN_REVIEW:         ['ASSIGNED_TO_SW'],
  FURTHER_REVIEW:           ['ASSIGNED_TO_SW', 'PC_REVIEW'],
  DEFERRED:                 ['PC_REVIEW'],
  COR_PENDING:              ['COR_REVIEW'],
  COR_REVIEW:               ['COR_ISSUED', 'COR_PENDING'],
  COR_ISSUED:               ['CLOSED'],
  EXPIRED:                  ['CERTIFICATE_READY', 'COR_PENDING'],   // after extension granted
};

const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

const STATUS_TO_NODE = {
  VERIFIED:               { type: 'PSO_VERIFIED',         label: 'PSO Verified' },
  ASSIGNED_TO_SW:         { type: 'SW_INITIAL',           label: 'SW Assigned' },
  ASSIGNED_TO_TO:         { type: 'TO_INSPECTION',        label: 'TO Inspection Assigned' },
  INSPECTION_SCHEDULED:   { type: 'INSPECTION_SCHEDULED', label: 'Inspection Scheduled' },
  INSPECTION_DONE:        { type: 'INSPECTION_DONE',      label: 'Inspection Completed' },
  SW_REVIEW:              { type: 'SW_REVIEW',            label: 'SW Review' },
  EXTERNAL_APPROVAL:      { type: 'EXTERNAL_REVIEW',      label: 'External Officer Review' },
  PC_REVIEW:              { type: 'PC_COMMITTEE',         label: 'PC Committee Review' },
  APPROVED:               { type: 'APPROVED',             label: 'Application Approved' },
  CONDITIONALLY_APPROVED: { type: 'APPROVED',             label: 'Application Conditionally Approved' },
  REJECTED:               { type: 'REJECTED',             label: 'Application Rejected' },
  FURTHER_REVIEW:         { type: 'FURTHER_REVIEW',       label: 'Further Review Required' },
  DEFERRED:               { type: 'DEFERRED',             label: 'Decision Deferred' },
  COR_REVIEW:             { type: 'COR_FINAL_INSPECTION', label: 'COR Review Started' },
  COR_ISSUED:             { type: 'COR_ISSUED',           label: 'COR Issued' },
};

const appendTrackingNodeForStatus = async (app, newStatus) => {
  const nodeDef = STATUS_TO_NODE[newStatus];
  if (!nodeDef) return;

  const line = await TrackingLine.findOne({ where: { application_id: app.application_id } });
  if (!line) return;

  const lastNode = await TrackingNode.findOne({
    where: { tracking_line_id: line.tracking_line_id },
    order: [['sequence_number', 'DESC']],
  });

  // Avoid duplicate nodes on repeated writes of same status.
  if (lastNode?.node_type === nodeDef.type) return;

  await trackingLineService.addNode(
    line.tracking_line_id,
    app.reference_number,
    nodeDef.type,
    nodeDef.label,
    { status: 'COMPLETED', completed_at: new Date() }
  );
};

const transition = async (applicationId, newStatus, updatedBy) => {
  const app = await Application.findByPk(applicationId);
  if (!app) throw new Error('Application not found');
  if (!canTransition(app.status, newStatus)) {
    throw new Error(`Cannot transition from '${app.status}' to '${newStatus}'`);
  }
  const updated = await app.update({ status: newStatus });
  await appendTrackingNodeForStatus(updated, newStatus);
  return updated;
};

/**
 * Force transition — used by admin override and webhook (skips validation).
 * Should only be used when the business rule warrants bypassing the state machine.
 */
const forceTransition = async (applicationId, newStatus) => {
  const app = await Application.findByPk(applicationId);
  if (!app) throw new Error('Application not found');
  const updated = await app.update({ status: newStatus });
  await appendTrackingNodeForStatus(updated, newStatus);
  return updated;
};

const computeExternalApprovalFlags = async (applicationId) => {
  const app = await Application.findByPk(applicationId, {
    include: [{ association: 'PlanType' }],
  });
  if (!app) return {};
  return {
    requires_ho:  app.PlanType?.requires_ho_approval  || false,
    requires_rda: app.PlanType?.requires_rda_approval || false,
    requires_gjs: app.PlanType?.requires_gjs_approval || false,
  };
};

const onApplicationCreate = async (application) => {
  if (application.submission_mode === 'WALK_IN') {
    return { autoReceiptPending: true };
  }
  return {};
};

module.exports = { canTransition, transition, forceTransition, computeExternalApprovalFlags, onApplicationCreate };
