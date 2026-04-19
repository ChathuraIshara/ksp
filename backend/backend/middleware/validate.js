const { badRequest } = require('../utils/responseHelper');

/**
 * validate(schema) — Express middleware.
 * Supports: required, string, number, boolean, email, uuid, phone, nic,
 *           min:<n>, max:<n>, enum:<a,b,c>, positive, integer
 */
const validate = (schema) => (req, res, next) => {
  const errors = [];
  const body   = req.body || {};

  for (const [field, rules] of Object.entries(schema)) {
    const parts    = rules.split('|');
    const value    = body[field];
    const required = parts.includes('required');
    const label    = field.replace(/_/g, ' ');

    const isEmpty = value === undefined || value === null || value === '';
    if (isEmpty) {
      if (required) errors.push(`${label} is required`);
      continue;
    }

    for (const rule of parts) {
      if (rule === 'required') continue;

      if (rule === 'password_complexity') {
        const str = String(value);
        const errors2 = [];
        if (!/[A-Z]/.test(str))           errors2.push('at least one uppercase letter');
        if (!/[a-z]/.test(str))           errors2.push('at least one lowercase letter');
        if (!/[0-9]/.test(str))           errors2.push('at least one number');
        if (!/[^A-Za-z0-9]/.test(str))    errors2.push('at least one special character');
        if (errors2.length > 0)
          errors.push(`${label} must contain: ${errors2.join(', ')}`);
      }

      if (rule === 'string' && typeof value !== 'string')
        errors.push(`${label} must be a string`);

      if (rule === 'number' && isNaN(Number(value)))
        errors.push(`${label} must be a number`);

      if (rule === 'integer' && (!Number.isInteger(Number(value))))
        errors.push(`${label} must be a whole number`);

      if (rule === 'positive' && Number(value) <= 0)
        errors.push(`${label} must be greater than 0`);

      if (rule === 'boolean' && typeof value !== 'boolean')
        errors.push(`${label} must be true or false`);

      if (rule === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
        errors.push(`${label} must be a valid email address`);

      if (rule === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value)))
        errors.push(`${label} must be a valid ID`);

      if (rule === 'nic' && !/^(\d{9}[VXvx]|\d{12})$/.test(String(value)))
        errors.push(`${label} must be a valid NIC (e.g. 123456789V or 200012345678)`);

      if (rule === 'phone' && !/^(\+94|0)\d{9}$/.test(String(value).replace(/\s/g, '')))
        errors.push(`${label} must be a valid Sri Lanka phone number`);

      if (rule.startsWith('min:')) {
        const min = parseInt(rule.split(':')[1]);
        if (typeof value === 'string' && value.length < min)
          errors.push(`${label} must be at least ${min} characters`);
        if (typeof value === 'number' && value < min)
          errors.push(`${label} must be at least ${min}`);
      }

      if (rule.startsWith('max:')) {
        const max = parseInt(rule.split(':')[1]);
        if (typeof value === 'string' && value.length > max)
          errors.push(`${label} must be at most ${max} characters`);
        if (typeof value === 'number' && value > max)
          errors.push(`${label} must be at most ${max}`);
      }

      if (rule.startsWith('enum:')) {
        const allowed = rule.split(':')[1].split(',');
        if (!allowed.includes(String(value)))
          errors.push(`${label} must be one of: ${allowed.join(', ')}`);
      }
    }
  }

  if (errors.length > 0) return badRequest(res, errors.join('; '));
  next();
};

// ── Schemas ───────────────────────────────────────────────────────────────────
validate.schemas = {

  // Auth
  register: {
    email:    'string|required|email',
    password: 'string|required|min:8|max:128|password_complexity',
    full_name:'string|required|min:2|max:255',
  },
  login: {
    email:    'string|required|email',
    password: 'string|required',
  },
  otp: {
    otp: 'string|required|min:4|max:4',
  },
  changePassword: {
    currentPassword: 'string|required',
    newPassword:     'string|required|min:8|max:128',
  },
  forgotPassword: {
    email: 'string|required|email',
  },
  resetPassword: {
    token:        'string|required|min:10',
    new_password: 'string|required|min:8|max:128|password_complexity',
  },

  // Application
  createApplication: {
    plan_type_id:    'string|required|uuid',
    tax_record_id:   'string|uuid',         // optional for ONLINE — PSO resolves during verification
    submission_mode: 'string|required|enum:ONLINE,WALK_IN',
    work_type:       'string|required|enum:NEW_CONSTRUCTION,RECONSTRUCTION,ADDITION,ALTERATION',
    proposed_use:    'string|required|enum:RESIDENTIAL,COMMERCIAL,INDUSTRIAL,PUBLIC,OTHER',
    sub_plan_type:   'string',              // e.g. residential, commercial, industrial, whole-land, subdivided
    story_type:      'string|enum:SINGLE_STORY,MULTI_STORY',  // for fee calculation
    building_area:   'number|positive',     // sqm for buildings
    site_area:       'number|positive',
  },
  updateApplicationStatus: {
    status: 'string|required',
  },

  // Payment
  createPayment: {
    reference_number: 'string|required',
    amount:           'number|required|positive',
    payment_type:     'string|required|enum:APPLICATION_FEE,APPROVAL_FEE,EXTENSION_FEE,COR_FEE,APPEAL_FEE,FINE_PAYMENT,LATE_COR_FEE',
    payment_method:   'string|required|enum:ONLINE,CASH,CHEQUE',
  },
  manualPayment: {
    reference_number: 'string|required',
    amount:           'number|required|positive',
    payment_type:     'string|required|enum:APPLICATION_FEE,APPROVAL_FEE,EXTENSION_FEE,COR_FEE,APPEAL_FEE,FINE_PAYMENT,LATE_COR_FEE',
    receipt_number:   'string|required|min:1',
  },
  onlinePayment: {
    reference_number: 'string|required',
    amount:           'number|required|positive',
    payment_type:     'string|required',
    return_url:       'string|required',
  },
  initiatePayhere: {
    reference_number: 'string|required',
    amount:           'number|required|positive',
    payment_type:     'string|required|enum:APPLICATION_FEE,APPROVAL_FEE,EXTENSION_FEE,COR_FEE,APPEAL_FEE,FINE_PAYMENT,LATE_COR_FEE',
    first_name:       'string|required|min:1|max:100',
    last_name:        'string|required|min:1|max:100',
    email:            'string|required|email',
    phone:            'string|required|phone',
  },
  verifyBankSlip: {
    verified: 'boolean|required',
  },

  // Inspection
  createInspection: {
    application_id:   'string|required|uuid',
    reference_number: 'string|required',
    officer_id:       'string|required|uuid',
    scheduled_date:   'string|required',
  },
  scheduleInspection: {
    scheduled_date: 'string|required',
  },
  counterSlot: {
    counter_date: 'string|required',
    counter_time: 'string|required',
  },

  // Inspection minute
  createMinute: {
    application_id:   'string|required|uuid',
    reference_number: 'string|required',
    inspection_id:    'string|uuid',   // required by DB — validated here to give a clear 400 before hitting the constraint
  },
  flagUnauthorized: {
    unauthorized_sqft: 'number|required|positive',
    fine_amount:       'number|required|positive',
    fine_reason:       'string|required|min:5',
  },

  // Complaint
  publicComplaint: {
    tax_number:         'string|required|min:3',
    complainant_name:   'string|required|min:2|max:255',
    complainant_contact:'string|required',
    complaint_type:     'string|required',
    description:        'string|required|min:20|max:2000',
  },
  createComplaint: {
    tax_number:   'string|required',
    complaint_type:'string|required',
    description:  'string|required|min:20',
  },
  resolveComplaint: {
    resolution_note: 'string|required|min:10',
  },

  // Appeal
  createAppeal: {
    reference_number:     'string|required',
    appeal_reason:        'string|required|min:20|max:2000',
    original_decision_id: 'string|optional',
  },
  appealDecision: {
    decision: 'string|required|enum:APPROVED,REJECTED',
    notes:    'string|required|min:10',
  },

  // Time extension
  createExtension: {
    reference_number:  'string|required',
    extension_years:   'number|required|integer|positive',
    reason:            'string|required|min:10|max:1000',
  },
  rejectExtension: {
    reason: 'string|required|min:10',
  },

  // COR application
  createCOR: {
    reference_number:  'string|required',
    completion_date:   'string|required',
  },
  complianceStatement: {
    statement: 'string|required|min:20',
  },

  // Decision / PC
  createDecision: {
    application_id: 'string|required|uuid',
    meeting_id:     'string|required|uuid',
    decision_type:  'string|required|enum:APPROVED,CONDITIONALLY_APPROVED,REJECTED,FURTHER_REVIEW,DEFERRED',
  },
  castVote: {
    decision_id: 'string|required|uuid',
    officer_id:  'string|required|uuid',
    vote:        'string|required|enum:FOR,AGAINST,ABSTAIN',
  },
  deferDecision: {
    new_meeting_id:     'string|required|uuid',
    pc_application_id:  'string|required|uuid',
  },

  // Task assignment
  createTask: {
    application_id: 'string|required|uuid',
    assigned_to:    'string|required|uuid',
    task_type:      'string|required',
  },

  // Message / Negotiation
  sendMessage: {
    reference_number:  'string',
    conversation_id:   'string|uuid',
    recipient_id:      'string|uuid',
    content:           'string|min:1|max:5000',
    body:              'string|min:1|max:5000',
    conversation_type: 'string|enum:TO_APPLICANT,SW_TO_CLARIFICATION,RDA_AGREEMENT_NEGOTIATION,COR_SCHEDULING',
    message_type:      'string',
  },

  // Fine
  createFine: {
    reference_number: 'string|required',
    fine_type:        'string|required|enum:UNAUTHORIZED_CONSTRUCTION,LATE_COR,LATE_PAYMENT',
    amount:           'number|required|positive',
    reason:           'string|required|min:5',
  },

  // PSO verification
  performVerification: {
    reference_number:        'string',
    application_id:          'string|required|uuid',
    name_match_result:       'string|required|enum:MATCH,MISMATCH,PENDING',
    doc_completeness_result: 'string|required|enum:COMPLETE,INCOMPLETE,PENDING',
  },

  // Queue
  assignToQueue: {
    application_id: 'string|required|uuid',
    queue_type:     'string|required',
  },

  // Officer / user
  createOfficer: {
    email:     'string|required|email',
    full_name: 'string|required|min:2|max:255',
    role:      'string|required|enum:PSO,SW,TO,PHI,HO,RDA,GJS,UDA,CHAIRMAN,ADMIN',
  },
  updateProfile: {
    email: 'string|email',
  },

  // Assessment tax record
  createTaxRecord: {
    tax_number:       'string|required|min:3|max:50',
    property_address: 'string|required|min:5|max:500',
  },

  // PC meeting
  createMeeting: {
    meeting_date: 'string',
    scheduled_date: 'string',
  },

  // Agreement
  createAgreement: {
    application_id:      'string|required|uuid',
    external_approval_id:'string|required|uuid',
    agreement_type:      'string|required',
  },

  // External approval
  submitApproval: {
    approval_status: 'string|required|enum:APPROVED,REJECTED,RETURNED',
    comments:        'string|required|min:5',
  },

  // Fee calculation
  calculateFee: {
    sqft: 'number|required|positive',
  },

  // Admin
  updateUserRole: {
    role: 'string|required|enum:PSO,SW,TO,PHI,HO,RDA,GJS,UDA,CHAIRMAN,ADMIN',
  },
  overrideStatus: {
    status: 'string|required',
    reason: 'string|required|min:5',
  },

  // Notification broadcast
  broadcastNotification: {
    title:   'string|required|min:2|max:255',
    message: 'string|required|min:5|max:1000',
    roles:   'string|required',
  },
};

module.exports = validate;
