const { Agreement, ExternalApproval } = require('../models');
const lockdownService = require('../services/lockdown.service');
const notifService = require('../services/notification.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

exports.createAgreement = async (req, res, next) => {
  try {
    // Whitelist — never allow signature flags, document_path, or lock state to be
    // injected on creation; those have dedicated endpoints.
    const { external_approval_id, reference_number, agreement_type } = req.body;
    if (!external_approval_id || !reference_number) {
      const { badRequest } = require('../utils/responseHelper');
      return badRequest(res, 'external_approval_id and reference_number are required');
    }
    const agreement = await Agreement.create({
      external_approval_id,
      reference_number,
      agreement_type: agreement_type || 'RDA_WAIVER',
    });
    return created(res, agreement);
  } catch (err) { next(err); }
};

exports.getByApproval = async (req, res, next) => {
  try {
    const agreement = await Agreement.findOne({ where: { external_approval_id: req.params.approvalId } });
    if (!agreement) return notFound(res);
    return success(res, agreement);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const agreements = await Agreement.findAll({ where: { reference_number: req.params.ref } });
    return success(res, agreements);
  } catch (err) { next(err); }
};

exports.uploadSignedAgreement = async (req, res, next) => {
  try {
    if (!req.file) return badRequest(res, 'No file uploaded');
    const agreement = await Agreement.findByPk(req.params.id);
    if (!agreement) return notFound(res);
    await agreement.update({ document_path: req.file.path });
    // Update RDA waiver flag on external approval
    await ExternalApproval.update({ waiver_uploaded: true }, { where: { external_approval_id: agreement.external_approval_id } });
    return success(res, { document_path: req.file.path }, 'Agreement/waiver uploaded');
  } catch (err) { next(err); }
};

exports.verifyWaiverUploaded = async (req, res, next) => {
  try {
    const agreement = await Agreement.findByPk(req.params.id);
    if (!agreement) return notFound(res);
    const uploaded = !!agreement.document_path;
    return success(res, { waiver_uploaded: uploaded, agreement_id: req.params.id });
  } catch (err) { next(err); }
};

exports.recordApplicantSignature = async (req, res, next) => {
  try {
    const agreement = await Agreement.findByPk(req.params.id);
    if (!agreement) return notFound(res);
    await agreement.update({ signed_by_applicant: true, applicant_signed_at: new Date() });
    return success(res, null, 'Applicant signature recorded');
  } catch (err) { next(err); }
};

exports.recordOfficerSignature = async (req, res, next) => {
  try {
    const agreement = await Agreement.findByPk(req.params.id);
    if (!agreement) return notFound(res);
    await agreement.update({ signed_by_officer: true, officer_signed_at: new Date(), officer_id: req.user.user_id });
    const bothSigned = agreement.signed_by_applicant && true;
    if (bothSigned) {
      await agreement.update({ negotiation_complete: true });
      await lockdownService.lockRecord(Agreement, agreement.agreement_id);
    }
    return success(res, { both_signed: bothSigned }, 'Officer signature recorded');
  } catch (err) { next(err); }
};

exports.verifyBothSigned = async (req, res, next) => {
  try {
    const agreement = await Agreement.findByPk(req.params.id);
    if (!agreement) return notFound(res);
    return success(res, { both_signed: agreement.signed_by_applicant && agreement.signed_by_officer });
  } catch (err) { next(err); }
};

exports.linkConversation = async (req, res, next) => {
  try {
    await Agreement.update({ conversation_id: req.body.conversation_id }, { where: { agreement_id: req.params.id } });
    return success(res, null, 'Conversation linked');
  } catch (err) { next(err); }
};

exports.notifyForSigning = async (req, res, next) => {
  try {
    const agreement = await Agreement.findByPk(req.params.id);
    if (!agreement) return notFound(res);
    await notifService.dispatch({
      recipient_id: req.body.applicant_id,
      event_type: 'AGREEMENT_SIGNING_REQUIRED',
      title: 'Agreement Signing Required',
      body: `Your agreement/waiver for application ${agreement.reference_number} requires your signature.`,
      channel: 'IN_APP',
      reference_number: agreement.reference_number,
    });
    await agreement.update({ notified_applicant_at: new Date() });
    return success(res, null, 'Applicant notified for signing');
  } catch (err) { next(err); }
};
