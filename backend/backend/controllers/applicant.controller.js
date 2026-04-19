const { Applicant, Application } = require('../models');
const { success, created, notFound, forbidden, error } = require('../utils/responseHelper');

const OFFICER_ROLES = ['PSO','SW','TO','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN'];
const isOfficer = (role) => OFFICER_ROLES.includes(role);

exports.createApplicant = async (req, res, next) => {
  try {
    // Whitelist — user_id must be provided by the calling context (e.g. admin/PSO
    // creating on behalf of a user), never injected freely. profile_photo_path
    // is set only via the dedicated upload endpoint.
    const { user_id, full_name, nic_number, phone, address } = req.body;
    if (!user_id || !full_name || !nic_number) {
      const { badRequest } = require('../utils/responseHelper');
      return badRequest(res, 'user_id, full_name, and nic_number are required');
    }
    const applicant = await Applicant.create({ user_id, full_name, nic_number, phone, address });
    return created(res, applicant);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const a = await Applicant.findByPk(req.params.id);
    if (!a) return notFound(res);
    // Applicants can only see their own profile
    if (!isOfficer(req.user.role) && req.user.applicant_id !== a.applicant_id) {
      return forbidden(res, 'Access denied');
    }
    return success(res, a);
  } catch (err) { next(err); }
};

exports.getByUserId = async (req, res, next) => {
  try {
    // Applicants can only look up their own user_id
    if (!isOfficer(req.user.role) && req.params.userId !== req.user.user_id) {
      return forbidden(res, 'Access denied');
    }
    const a = await Applicant.findOne({ where: { user_id: req.params.userId } });
    if (!a) return notFound(res);
    return success(res, a);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const a = await Applicant.findByPk(req.params.id);
    if (!a) return notFound(res);
    if (!isOfficer(req.user.role) && req.user.applicant_id !== a.applicant_id) {
      return forbidden(res, 'Access denied');
    }
    // Prevent applicants from changing their own role or user_id
    const { user_id, ...safeBody } = req.body;
    await a.update(safeBody);
    return success(res, a);
  } catch (err) { next(err); }
};

exports.uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);
    const a = await Applicant.findByPk(req.params.id);
    if (!a) return notFound(res);
    if (!isOfficer(req.user.role) && req.user.applicant_id !== a.applicant_id) {
      return forbidden(res, 'Access denied');
    }
    await Applicant.update({ profile_photo_path: req.file.path }, { where: { applicant_id: req.params.id } });
    return success(res, { path: req.file.path }, 'Photo uploaded');
  } catch (err) { next(err); }
};

exports.getApplicationHistory = async (req, res, next) => {
  try {
    if (!isOfficer(req.user.role) && req.user.applicant_id !== req.params.id) {
      return forbidden(res, 'Access denied');
    }
    const applications = await Application.findAll({
      where: { applicant_id: req.params.id },
      order: [['created_at','DESC']],
    });
    return success(res, applications);
  } catch (err) { next(err); }
};
