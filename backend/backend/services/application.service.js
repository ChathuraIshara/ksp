const { Application } = require('../models');

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
  PC_REVIEW:                ['APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'FURTHER_REVIEW', 'DEFERRED'],
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

const transition = async (applicationId, newStatus, updatedBy) => {
  const app = await Application.findByPk(applicationId);
  if (!app) throw new Error('Application not found');
  if (!canTransition(app.status, newStatus)) {
    throw new Error(`Cannot transition from '${app.status}' to '${newStatus}'`);
  }
  return app.update({ status: newStatus });
};

/**
 * Force transition — used by admin override and webhook (skips validation).
 * Should only be used when the business rule warrants bypassing the state machine.
 */
const forceTransition = async (applicationId, newStatus) => {
  const app = await Application.findByPk(applicationId);
  if (!app) throw new Error('Application not found');
  return app.update({ status: newStatus });
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
