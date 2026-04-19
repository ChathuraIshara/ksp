const { forbidden } = require('../utils/responseHelper');

// Pass model and the PK param name, e.g. immutableGuard(Application, 'application_id')
const immutableGuard = (Model, pkParam) => async (req, res, next) => {
  const pk = req.params[pkParam];
  if (!pk) return next();
  try {
    const record = await Model.findByPk(pk);
    if (record && record.is_immutable) {
      return forbidden(res, 'This record is locked and cannot be modified.');
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { immutableGuard };
