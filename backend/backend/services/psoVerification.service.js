const { AssessmentTaxRecord, TaxRecordOwner, Complaint } = require('../models');

const lookupTaxRecord = async (taxNumber) => {
  const record = await AssessmentTaxRecord.findOne({
    where: { tax_number: taxNumber, is_active: true },
    include: [{ model: TaxRecordOwner, where: { is_active: true }, required: false }],
  });
  return record;
};

const checkNameMatch = (submittedName, owners = []) => {
  if (!owners.length) return { result: 'PENDING', matched: false };
  const normalize = (s) => s.toLowerCase().replace(/\s+/g, '');
  const matched = owners.some(o => normalize(o.owner_name) === normalize(submittedName));
  return { result: matched ? 'MATCHED' : 'MISMATCH', matched };
};

const checkDocumentCompleteness = (submittedCategories = [], requiredDocs = []) => {
  const missing = requiredDocs.filter(req => !submittedCategories.includes(req));
  return { complete: missing.length === 0, missing };
};

const hasActiveComplaints = async (taxNumber) => {
  const count = await Complaint.count({ where: { tax_number: taxNumber, status: 'PENDING' } });
  return count > 0;
};

module.exports = { lookupTaxRecord, checkNameMatch, checkDocumentCompleteness, hasActiveComplaints };
