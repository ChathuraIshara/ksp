const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const error = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({ success: false, message, errors });
};

const created = (res, data, message = 'Created successfully') => success(res, data, message, 201);
const notFound = (res, message = 'Resource not found') => error(res, message, 404);
const unauthorized = (res, message = 'Unauthorized') => error(res, message, 401);
const forbidden = (res, message = 'Forbidden') => error(res, message, 403);
const badRequest = (res, message = 'Bad request', errors = null) => error(res, message, 400, errors);

const tooManyRequests = (res, message = 'Too many requests') => error(res, message, 429);

module.exports = { success, error, created, notFound, unauthorized, forbidden, badRequest, tooManyRequests };
