const { TaxOwnerChangeHistory } = require('../models');
const { success, created, error } = require('../utils/responseHelper');

exports.createHistory = async (req, res, next) => {
  try {
    const h = await TaxOwnerChangeHistory.create({ ...req.body, changed_by: req.user.user_id });
    return created(res, h);
  } catch (err) { next(err); }
};

exports.getByTaxRecord = async (req, res, next) => {
  try {
    const records = await TaxOwnerChangeHistory.findAll({ where: { tax_record_id: req.params.id }, order: [['created_at','DESC']] });
    return success(res, records);
  } catch (err) { next(err); }
};

exports.getByOwner = async (req, res, next) => {
  try {
    const records = await TaxOwnerChangeHistory.findAll({ where: { owner_id: req.params.ownerId } });
    return success(res, records);
  } catch (err) { next(err); }
};

exports.getByApplication = async (req, res, next) => {
  try {
    const records = await TaxOwnerChangeHistory.findAll({ where: { application_ref: req.params.ref } });
    return success(res, records);
  } catch (err) { next(err); }
};

exports.uploadProofDocument = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);
    const h = await TaxOwnerChangeHistory.findByPk(req.params.id);
    if (!h) return error(res, 'History record not found', 404);
    await h.update({ proof_document_path: req.file.path });
    return success(res, { path: req.file.path });
  } catch (err) { next(err); }
};

exports.auditNameChanges = async (req, res, next) => {
  try {
    const records = await TaxOwnerChangeHistory.findAll({ where: { tax_record_id: req.params.id, change_type: 'NAME_CHANGE' }, order: [['created_at','DESC']] });
    return success(res, records);
  } catch (err) { next(err); }
};
