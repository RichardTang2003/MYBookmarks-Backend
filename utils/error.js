// Helper to produce uniform error responses: { error: string, code?: string }
function send(res, status, message, code) {
  const payload = { error: message };
  if (code) payload.code = code;
  return res.status(status).json(payload);
}

function badRequest(res, message = 'Bad request', code = 'INVALID_INPUT') {
  return send(res, 400, message, code);
}

function notFound(res, message = 'Not found', code = 'NOT_FOUND') {
  return send(res, 404, message, code);
}

function forbidden(res, message = 'Forbidden', code = 'FORBIDDEN') {
  return send(res, 403, message, code);
}

function serverError(res, message = 'Internal server error', code = 'DB_ERROR') {
  return send(res, 500, message, code);
}

function authRequired(res, message = 'Authorization header required', code = 'AUTH_REQUIRED') {
  return send(res, 401, message, code);
}

function invalidAuthHeader(res, message = 'Invalid authorization header', code = 'INVALID_AUTH_HEADER') {
  return send(res, 401, message, code);
}

function invalidToken(res, message = 'Invalid or expired token', code = 'INVALID_TOKEN') {
  return send(res, 401, message, code);
}

function authFailed(res, message = 'Authentication failed', code = 'AUTH_FAILED') {
  return send(res, 401, message, code);
}

module.exports = {
  send,
  badRequest,
  notFound,
  forbidden,
  serverError,
  authRequired,
  invalidAuthHeader,
  invalidToken,
  authFailed,
};
