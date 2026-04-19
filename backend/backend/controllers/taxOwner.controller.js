const { TaxRecordOwner, AssessmentTaxRecord } = require('../models');
const psoService = require('../services/psoVerification.service');
const { success, created, notFound, error } = require('../utils/responseHelper');

exports.createOwner = async (req, res, next) => {
  try {
    const owner = await TaxRecordOwner.create({ ...req.body, tax_record_id: req.params.id });
    return created(res, owner);
  } catch (err) { next(err); }
};

exports.getOwnersByTaxRecord = async (req, res, next) => {
  try {
    const owners = await TaxRecordOwner.findAll({ where: { tax_record_id: req.params.id } });
    return success(res, owners);
  } catch (err) { next(err); }
};

exports.getCurrentOwners = async (req, res, next) => {
  try {
    const owners = await TaxRecordOwner.findAll({ where: { tax_record_id: req.params.id, is_active: true } });
    return success(res, owners);
  } catch (err) { next(err); }
};

exports.getPrimaryOwner = async (req, res, next) => {
  try {
    const owner = await TaxRecordOwner.findOne({ where: { tax_record_id: req.params.id, is_primary: true, is_active: true } });
    if (!owner) return notFound(res, 'No primary owner found');
    return success(res, owner);
  } catch (err) { next(err); }
};

exports.updateOwner = async (req, res, next) => {
  try {
    const owner = await TaxRecordOwner.findOne({ where: { tax_record_id: req.params.id, owner_id: req.params.ownerId } });
    if (!owner) return notFound(res);
    await owner.update(req.body);
    return success(res, owner);
  } catch (err) { next(err); }
};

exports.deactivateOwner = async (req, res, next) => {
  try {
    await TaxRecordOwner.update({ is_active: false }, { where: { owner_id: req.params.ownerId, tax_record_id: req.params.id } });
    return success(res, null, 'Owner deactivated');
  } catch (err) { next(err); }
};

exports.verifyNameMatch = async (req, res, next) => {
  try {
    const { submitted_name } = req.query;
    const record = await AssessmentTaxRecord.findOne({ where: { tax_number: req.params.taxNumber }, include: [{ model: TaxRecordOwner, where: { is_active: true }, required: false }] });
    if (!record) return notFound(res, 'Tax record not found');
    const result = psoService.checkNameMatch(submitted_name, record.TaxRecordOwners || []);
    return success(res, result);
  } catch (err) { next(err); }
};
