const { ExternalApproval, Agreement } = require('../models');

const createExternalApprovals = async (applicationId, referenceNumber, flags = {}, createdBy) => {
  const approvals = [];
  if (flags.requires_ho) {
    approvals.push({ application_id: applicationId, reference_number: referenceNumber, officer_type: 'HO', forwarded_by: createdBy, forwarded_at: new Date() });
  }
  if (flags.requires_rda) {
    approvals.push({ application_id: applicationId, reference_number: referenceNumber, officer_type: 'RDA', requires_waiver: true, forwarded_by: createdBy, forwarded_at: new Date() });
  }
  if (flags.requires_gjs) {
    approvals.push({ application_id: applicationId, reference_number: referenceNumber, officer_type: 'GJS', forwarded_by: createdBy, forwarded_at: new Date() });
  }
  return ExternalApproval.bulkCreate(approvals);
};

const checkAllComplete = async (referenceNumber) => {
  const approvals = await ExternalApproval.findAll({ where: { reference_number: referenceNumber } });
  if (!approvals.length) return true;
  return approvals.every(a => ['APPROVED','RETURNED'].includes(a.approval_status));
};

const verifyRDAWaiverUploaded = async (approvalId) => {
  const agreement = await Agreement.findOne({ where: { external_approval_id: approvalId } });
  return agreement?.document_path != null;
};

module.exports = { createExternalApprovals, checkAllComplete, verifyRDAWaiverUploaded };
