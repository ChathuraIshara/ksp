// Role-filters tracking node details and blocks certificate download for APPLICANT role
const trackingViewGuard = (req, res, next) => {
  req.isApplicant = req.user?.role === 'APPLICANT';
  req.isOfficer = !req.isApplicant;

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (req.isApplicant && body?.data) {
      body.data = filterForApplicant(body.data);
    }
    return originalJson(body);
  };
  next();
};

const filterForApplicant = (data) => {
  if (!data) return data;
  const HIDDEN_FIELDS = [
    'minutes','internal_notes','pso_notes','complaint_details',
    'fine_calculation_details','verification_log','officer_comments',
    'uda_minute','member_comments','conversation_threads','to_minute',
  ];
  if (Array.isArray(data)) return data.map(filterForApplicant);
  if (typeof data === 'object') {
    const filtered = { ...data };
    HIDDEN_FIELDS.forEach(f => delete filtered[f]);
    // Block file download — return only view URL
    if (filtered.pdf_path) {
      filtered.can_download = false;
      filtered.view_message = 'Please collect the official stamped copy at the Pradeshiya Sabha office.';
      delete filtered.pdf_path;
    }
    return filtered;
  }
  return data;
};

module.exports = trackingViewGuard;
