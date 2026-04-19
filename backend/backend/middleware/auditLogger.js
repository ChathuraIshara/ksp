const { AuditLog } = require('../models');

const auditLogger = (req, res, next) => {
  const originalJson = res.json.bind(res);
  const beforeState = req.body || null;

  // res.json stays synchronous — audit write fires in background (non-blocking)
  res.json = (body) => {
    if (['POST','PUT','DELETE','PATCH'].includes(req.method) && res.statusCode < 400) {
      setImmediate(() => {
        AuditLog.create({
          user_id:          req.user?.user_id,
          reference_number: req.params?.ref || req.body?.reference_number,
          action:           `${req.method} ${req.path}`,
          request_id:       req.requestId,
          entity_type:      req.path.split('/')[1],
          before_state:     req.method !== 'POST' ? beforeState : null,
          after_state:      body?.data || null,
          ip_address:       req.ip,
          user_agent:       req.get('user-agent'),
        }).catch(() => { /* Non-blocking — never crash request on audit failure */ });
      });
    }
    return originalJson(body);
  };
  next();
};

module.exports = auditLogger;
