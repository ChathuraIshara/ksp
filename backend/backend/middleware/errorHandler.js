const { error } = require('../utils/responseHelper');
const env = require('../config/env');

module.exports = (err, req, res, next) => {
  // Always log full detail server-side (never sent to client)
  console.error('[ERROR]', {
    message: err.message,
    stack:   err.stack,
    path:    req.path,
    method:  req.method,
    user:    req.user?.user_id || 'unauthenticated',
  });

  if (err.name === 'SequelizeValidationError')
    return error(res, 'Validation error', 422, err.errors?.map(e => e.message));
  if (err.name === 'SequelizeUniqueConstraintError')
    return error(res, 'Duplicate entry — this record already exists', 409);
  if (err.name === 'SequelizeForeignKeyConstraintError')
    return error(res, 'Referenced record does not exist', 422);
  if (err.message === 'Unexpected field' || err.message?.includes('Only PDF'))
    return error(res, err.message, 400);

  // In production: never leak internal error messages to the client
  // In development: include message for easier debugging
  const clientMessage = env.nodeEnv === 'production'
    ? 'An internal server error occurred. Please try again or contact support.'
    : (err.message || 'Internal server error');

  return error(res, clientMessage, err.status || 500);
};
