import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const api = axios.create({
  baseURL: BASE,
  timeout: 30_000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 → redirect to login (except for auth endpoints themselves)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url ?? ''
    const isAuthEndpoint = url.includes('/auth/login') ||
                           url.includes('/auth/register') ||
                           url.includes('/auth/me') ||
                           url.includes('/auth/verify-otp') ||
                           url.includes('/auth/forgot-password') ||
                           url.includes('/auth/reset-password')
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Only redirect if not already on login page
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:          (data: { email: string; password: string }) => api.post('/auth/login', data),
  register:       (data: any) => api.post('/auth/register', data),
  googleAuth:     (accessToken: string) => api.post('/auth/google', { accessToken }),
  me:             () => api.get('/auth/me'),
  logout:         () => api.post('/auth/logout'),
  sendOTP:        () => api.post('/auth/send-otp'),
  verifyOTP:      (code: string) => api.post('/auth/verify-otp', { code }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (data: any) => api.post('/auth/reset-password', data),
  generateOTP:    () => api.post('/auth/generate-otp'),    // Chairman digital signature OTP only
}

// ── Applications ──────────────────────────────────────────────────────────────
export const applicationApi = {
  create:           (data: any) => api.post('/applications', data),
  createWalkIn:     (data: any) => api.post('/applications/walk-in', data),
  myApplications:   () => api.get('/applications/my'),
  listAll:          (params?: any) => api.get('/applications', { params }),
  getByRef:         (ref: string) => api.get(`/applications/${ref}`),
  getByApplicant:   (id: string) => api.get(`/applications/applicant/${id}`),
  getByTaxNumber:   (tax: string) => api.get(`/applications/tax/${tax}`),
  getByStatus:      (status: string) => api.get(`/applications/status/${status}`),
  search:           (params: any) => api.get('/applications/search', { params }),
  psoQueue:         (params?: any) => api.get('/applications/pso/queue', { params }),
  swAssigned:       () => api.get('/applications/sw/assigned'),
  toAssigned:       () => api.get('/applications/to/assigned'),
  updateStatus:     (ref: string, status: string) => api.put(`/applications/${ref}/status`, { status }),
  updateStage:      (ref: string, stage: string) => api.put(`/applications/${ref}/stage`, { stage }),
  generateRef:      (ref: string) => api.post(`/applications/${ref}/generate-ref`),
  checkExpiry:      (ref: string) => api.get(`/applications/${ref}/expiry-status`),
  withFlags:        () => api.get('/applications/with-flags'),
  swReviewSubmit:   (id: string) => api.post(`/applications/${id}/sw-review-submit`),
  psoEdit:          (ref: string, data: any) => api.put(`/applications/${ref}/pso-edit`, data),
  setRejection:     (ref: string, reason: string) => api.put(`/applications/${ref}/rejection-reason`, { reason }),
}

// ── Plan Types & Fees ─────────────────────────────────────────────────────────
export const planTypeApi = {
  list:           () => api.get('/plan-types'),
  getById:        (id: string) => api.get(`/plan-types/${id}`),
}

export const feeApi = {
  getAll:             () => api.get('/fee-configurations'),
  getByPlanType:      (id: string) => api.get(`/fee-configurations/plan-type/${id}`),
  calculateBuilding:  (data: any) => api.post('/fee-configurations/calculate/building', data),
  calculatePlot:      (data: any) => api.post('/fee-configurations/calculate/plot', data),
  calculateWall:      (data: any) => api.post('/fee-configurations/calculate/wall', data),
  calculateExtension: (ref: string) => api.get(`/extensions/ref/${ref}/calculate-fee`),
}

// ── Assessment Tax ────────────────────────────────────────────────────────────
export const taxApi = {
  getByTaxNumber:     (tax: string) => api.get(`/tax-records/number/${tax}`),
  psoLookup:          (tax: string) => api.get(`/tax-records/pso-lookup/${tax}`),
  hasComplaints:      (tax: string) => api.get(`/tax-records/number/${tax}/has-complaints`),
  searchByAddress:    (q: string) => api.get('/tax-records/search', { params: { q } }),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentApi = {
  upload:        (appId: string, formData: FormData) =>
    api.post(`/documents/upload/${appId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadByRef:   (formData: FormData) =>
    api.post(`/documents/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getByRef:      (ref: string) => api.get(`/documents/ref/${ref}`),
  deleteDoc:     (id: string) => api.delete(`/documents/${id}`),
}

// ── PSO Verification ──────────────────────────────────────────────────────────
export const psoApi = {
  verify:       (data: any) => api.post('/pso-verification', data),
  getHistory:   (ref: string) => api.get(`/pso-verification/${ref}/history`),
}

// ── Queues ────────────────────────────────────────────────────────────────────
export const queueApi = {
  list:           () => api.get('/queues'),
  getByType:      (type: string) => api.get(`/queues/type/${type}`),
  assign:         (data: any) => api.post('/queues/assign', data),
  getAssignments: (params?: any) => api.get('/queues/assignments', { params }),
}

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentApi = {
  // Bug fix: getByRef now accepts both reference_number AND application_id (UUID)
  // The backend /payments/ref/:ref endpoint was updated to handle both cases,
  // and APPLICANT role was added to the allowRoles guard.
  getByRef:       (ref: string) => api.get(`/payments/ref/${ref}`),
  initiatePayhere:(data: any) => api.post('/payments/initiate-payhere', data),
  online:         (data: any) => api.post('/payments/online', data),
  manual:         (data: any) => api.post('/payments/manual', data),
  verifySlip:     (id: string, data: any) => api.post(`/payments/${id}/verify-slip`, data),
  pendingSlips:   () => api.get('/payments/pending-slips'),
  updateStatus:   (id: string, status: string) => api.put(`/payments/${id}/status`, { status }),
  totalPaid:      (ref: string) => api.get(`/payments/ref/${ref}/total`),
  receipt:        (id: string) => api.get(`/payments/${id}/receipt`),
  // Demo/dev only — simulate payment completion without real PayHere (disabled in production)
  simulateCompletion: (reference_number: string, payment_type: string) =>
    api.post('/payments/simulate-completion', { reference_number, payment_type }),
}

// ── Fines ─────────────────────────────────────────────────────────────────────
export const fineApi = {
  getByRef:   (ref: string) => api.get(`/fines/ref/${ref}`),
  create:     (data: any) => api.post('/fines', data),
  waive:      (id: string, data: any) => api.put(`/fines/${id}/waive`, data),
}

// ── Task Assignments ──────────────────────────────────────────────────────────
export const taskApi = {
  create:       (data: any) => api.post('/tasks', data),
  getByOfficer: (id: string) => api.get(`/tasks/officer/${id}`),
  getByRef:     (ref: string) => api.get(`/tasks/ref/${ref}`),
  swDashboard:  () => api.get('/tasks/sw-dashboard'),
  mine:         () => api.get('/tasks/mine'),
  updateStatus: (id: string, status: string) => api.put(`/tasks/${id}/status`, { status }),
  complete:     (id: string) => api.put(`/tasks/${id}/complete`),
  reassign:     (id: string, data: any) => api.put(`/tasks/${id}/reassign`, data),
  workload:     (id: string) => api.get(`/tasks/officer/${id}/workload`),
}

// ── Inspections ───────────────────────────────────────────────────────────────
export const inspectionApi = {
  create:         (data: any) => api.post('/inspections', data),
  getByRef:       (ref: string) => api.get(`/inspections/ref/${ref}`),
  getByOfficer:   (id: string) => api.get(`/inspections/officer/${id}`),
  schedule:       (id: string, date: string) => api.put(`/inspections/${id}/schedule`, { scheduled_date: date }),
  reschedule:     (id: string, date: string) => api.put(`/inspections/${id}/reschedule`, { scheduled_date: date }),
  complete:       (id: string) => api.put(`/inspections/${id}/complete`),
  cancel:         (id: string, reason: string) => api.put(`/inspections/${id}/cancel`, { reason }),
  counterSlot:    (id: string, data: any) => api.post(`/inspections/${id}/counter-slot`, data),
  acceptSlot:     (id: string) => api.put(`/inspections/${id}/accept-slot`),
  negotiationLog: (id: string) => api.get(`/inspections/${id}/negotiation-log`),
}

// ── Inspection Minutes ────────────────────────────────────────────────────────
export const inspectionMinuteApi = {
  create:              (data: any) => api.post('/inspection-minutes', data),
  getByRef:            (ref: string) => api.get(`/inspection-minutes/ref/${ref}`),
  getById:             (id: string) => api.get(`/inspection-minutes/${id}`),
  saveDraft:           (id: string, data: any) => api.put(`/inspection-minutes/${id}/draft`, data),
  submit:              (id: string) => api.post(`/inspection-minutes/${id}/submit`),
  addMeasurements:     (id: string, data: any) => api.put(`/inspection-minutes/${id}/measurements`, data),
  flagUnauthorized:    (id: string, data: any) => api.post(`/inspection-minutes/${id}/flag-unauthorized`, data),
  autoCalculateFee:    (id: string) => api.post(`/inspection-minutes/${id}/calculate-fee`),
  editSubmitted:       (id: string, data: any) => api.put(`/inspection-minutes/${id}/edit-submitted`, data),
}

// ── Minutes ───────────────────────────────────────────────────────────────────
export const minuteApi = {
  create:    (data: any) => api.post('/minutes', data),
  getByRef:  (ref: string) => api.get(`/minutes/ref/${ref}`),
  getById:   (id: string) => api.get(`/minutes/${id}`),
  saveDraft: (id: string, data: any) => api.put(`/minutes/${id}/draft`, data),
  submit:    (id: string) => api.post(`/minutes/${id}/submit`),
}

// ── External Approvals ────────────────────────────────────────────────────────
export const externalApprovalApi = {
  create:         (data: any) => api.post('/external-approvals', data),
  forward:        (data: any) => api.post('/external-approvals/forward', data),
  getByRef:       (ref: string) => api.get(`/external-approvals/ref/${ref}`),
  uploadMinute:   (id: string, formData: FormData) =>
    api.post(`/external-approvals/${id}/minute`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  submitMinute:   (id: string, data: any) => api.post(`/external-approvals/${id}/submit-minute`, data),
  getMyApprovals: () => api.get('/external-approvals/officer/mine'),
}

// ── PC Meetings ───────────────────────────────────────────────────────────────
export const pcMeetingApi = {
  create:         (data: any) => api.post('/pc-meetings', data),
  list:           () => api.get('/pc-meetings'),
  getById:        (id: string) => api.get(`/pc-meetings/${id}`),
  upcoming:       () => api.get('/pc-meetings/upcoming'),
  addApplication: (id: string, data: any) => api.post(`/pc-meetings/${id}/add-application`, data),
  addMinute:      (meetingId: string, appId: string, data: any) =>
    api.post(`/pc-meetings/${meetingId}/applications/${appId}/minute`, data),
  updateAgenda:   (id: string, data: any) => api.put(`/pc-meetings/${id}/agenda`, data),
  complete:       (id: string) => api.put(`/pc-meetings/${id}/complete`),
  castVote:       (data: any) => api.post('/pc-meetings/votes/cast', data),
}

// ── Decisions ─────────────────────────────────────────────────────────────────
export const decisionApi = {
  create:   (data: any) => api.post('/decisions', data),
  getByRef: (ref: string) => api.get(`/decisions/ref/${ref}`),
}

// ── Approval Certificates ─────────────────────────────────────────────────────
export const certApi = {
  generate:  (data: any) => api.post('/approval-certificates', data),
  getByRef:  (ref: string) => api.get(`/approval-certificates/ref/${ref}`),
  listAll:   (params?: any) => api.get('/approval-certificates', { params }),
  sign:      (id: string, otp: string) => api.put(`/approval-certificates/${id}/sign`, { otp_code: otp }),
  batchSign: (certificate_ids: string[], otp: string) =>
    api.post('/approval-certificates/batch-sign', { certificate_ids, otp_code: otp }),
  download:  (ref: string) => api.get(`/approval-certificates/ref/${ref}/download`),
  issue:     (id: string) => api.post(`/approval-certificates/${id}/issue`),
  print:     (id: string, reason?: string) => api.post(`/approval-certificates/${id}/print`, { reason }),
}

// ── COR ───────────────────────────────────────────────────────────────────────
export const corApi = {
  apply:            (data: any) => api.post('/cor-applications', data),
  getByRef:         (ref: string) => api.get(`/cor-applications/ref/${ref}`),
  checkLateFine:    (ref: string) => api.get(`/cor-applications/ref/${ref}/check-late-fine`),
  checkEligibility: (ref: string) => api.get(`/cor-applications/ref/${ref}/eligibility`),
  uploadPhotos:     (id: string, formData: FormData) =>
    api.post(`/cor-applications/${id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  scheduleFinal:    (id: string) => api.post(`/cor-applications/${id}/schedule-inspection`),
  linkPayment:      (id: string, payment_id: string) => api.put(`/cor-applications/${id}/link-payment`, { payment_id }),
  updateStatus:     (id: string, status: string) => api.put(`/cor-applications/${id}/status`, { status }),
}

export const corCertApi = {
  generate: (data: any) => api.post('/cor-certificates', data),
  getAll:   (params?: any) => api.get('/cor-certificates', { params }),
  getByRef: (ref: string) => api.get(`/cor-certificates/ref/${ref}`),
  sign:     (id: string, otp: string) => api.put(`/cor-certificates/${id}/sign`, { otp_code: otp }),
  issue:    (id: string) => api.post(`/cor-certificates/${id}/issue`),
  print:    (id: string, reason?: string) => api.post(`/cor-certificates/${id}/print`, { reason }),
}

// ── Time Extensions ───────────────────────────────────────────────────────────
export const extensionApi = {
  create:         (data: any) => api.post('/extensions', data),
  getByRef:       (ref: string) => api.get(`/extensions/ref/${ref}`),
  calculateFee:   (ref: string) => api.get(`/extensions/ref/${ref}/calculate-fee`),
  eligibility:    (ref: string) => api.get(`/extensions/ref/${ref}/eligibility`),
  latestDeadline: (ref: string) => api.get(`/extensions/ref/${ref}/latest-deadline`),
  approve:        (id: string) => api.put(`/extensions/${id}/approve`),
  reject:         (id: string, reason: string) => api.put(`/extensions/${id}/reject`, { reason }),
}

// ── Appeals ───────────────────────────────────────────────────────────────────
export const appealApi = {
  create:       (data: any) => api.post('/appeals', data),
  getByRef:     (ref: string) => api.get(`/appeals/ref/${ref}`),
  submit:       (id: string) => api.post(`/appeals/${id}/submit`),
  escalateToTO: (id: string, data?: any) => api.post(`/appeals/${id}/escalate-to-to`, data),
  uploadDocs:   (id: string, formData: FormData) =>
    api.post(`/appeals/${id}/revised-docs`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

// ── Complaints ────────────────────────────────────────────────────────────────
export const complaintApi = {
  createPublic: (data: any) => api.post('/complaints/public', data),
  getByRef:     (ref: string) => api.get(`/complaints/ref/${ref}`),
  getByTax:     (tax: string) => api.get(`/complaints/tax/${tax}`),
  resolve:      (id: string, data: any) => api.post(`/complaints/${id}/resolve`, data),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationApi = {
  list:        (params?: any) => api.get('/notifications', { params }),
  markRead:    (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/mark-all-read'),
  unreadCount: () => api.get('/notifications/unread-count'),
}

// ── Messages (in-app chat) ────────────────────────────────────────────────────
export const messageApi = {
  getConversations: () => api.get('/messages/conversations'),
  getThread:        (convId: string) => api.get(`/messages/conversation/${convId}`),
  send:             (data: any) => api.post('/messages', data),
  startConv:        (data: any) => api.post('/messages/conversations', data),
  markRead:         (id: string) => api.put(`/messages/${id}/read`),
}

// ── Tracking ──────────────────────────────────────────────────────────────────
// Bug fix: all tracking endpoints now accept EITHER a reference_number OR an
// application_id (UUID). This is needed for DRAFT apps that have no ref yet.
// The backend tracking.controller.js was updated with getAppByRefOrId() to handle both.
export const trackingApi = {
  // Full tracking line — used by officers and as a fallback
  // Accepts: reference_number OR application_id (UUID)
  getByRef: (ref: string) => api.get(`/tracking/ref/${ref}`),

  // Applicant-filtered view — only is_visible_to_applicant=true nodes
  // Accepts: reference_number OR application_id (UUID) for DRAFT apps
  applicantView: (ref: string) => api.get(`/tracking/ref/${ref}/applicant-view`),

  // Individual node detail
  getNode: (ref: string, nodeId: string) => api.get(`/tracking/${ref}/nodes/${nodeId}`),

  // Officer sets whether a node's content is visible to the applicant
  setVisibility: (ref: string, nodeId: string, visible: boolean) =>
    api.put(`/tracking/${ref}/nodes/${nodeId}/visibility`, { is_visible_to_applicant: visible }),
}

// ── Officers ──────────────────────────────────────────────────────────────────
export const officerApi = {
  list:      (params?: any) => api.get('/officers', { params }),
  getByRole: (role: string) => api.get('/officers', { params: { role } }),
  getById:   (id: string) => api.get(`/officers/${id}`),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  listOfficers:     (params?: any) => api.get('/admin/users', { params }),
  createOfficer:    (data: any) => api.post('/admin/officers', data),
  editOfficer:      (id: string, data: any) => api.put(`/admin/users/${id}/edit`, data),
  approveOfficer:   (id: string) => api.put(`/admin/users/${id}/approve`),
  rejectOfficer:    (id: string, reason: string) => api.put(`/admin/users/${id}/reject`, { reason }),
  suspendUser:      (id: string, reason?: string) => api.put(`/admin/users/${id}/suspend`, { reason }),
  resetPassword:    (id: string) => api.put(`/admin/users/${id}/reset-password`),
  dashboardStats:   () => api.get('/admin/dashboard-stats'),
  generateReport:   (params: any) => api.get('/admin/reports', { params }),
  systemHealth:     () => api.get('/admin/health'),
  applicationStats: () => api.get('/admin/application-stats'),
  processingTime:   (params?: any) => api.get('/admin/reports/processing-time', { params }),
}

// ── TO Availability ───────────────────────────────────────────────────────────
export const toAvailabilityApi = {
  getMyCalendar:     () => api.get('/to-availability/my-calendar'),
  checkAvailability: (officerId: string, date: string) => api.get(`/to-availability/${officerId}/${date}`),
  getAvailableTOs:   (date: string) => api.get(`/to-availability/available/${date}`),
  set:               (data: any) => api.post('/to-availability', data),
}

// ── Agreements (RDA Waiver) ───────────────────────────────────────────────────
export const agreementApi = {
  getByRef:            (ref: string) => api.get(`/agreements/ref/${ref}`),
  recordApplicantSign: (id: string) => api.put(`/agreements/${id}/sign-applicant`),
  verifyWaiver:        (id: string) => api.get(`/agreements/${id}/verify-waiver`),
  verifyBothSigned:    (id: string) => api.get(`/agreements/${id}/both-signed`),
}

// ── Applicant Profile ─────────────────────────────────────────────────────────
export const applicantApi = {
  getById:     (id: string) => api.get(`/applicants/${id}`),
  getByUserId: (userId: string) => api.get(`/applicants/user/${userId}`),
  update:      (id: string, data: any) => api.put(`/applicants/${id}`, data),
  uploadPhoto: (id: string, formData: FormData) =>
    api.post(`/applicants/${id}/photo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  history:     (id: string) => api.get(`/applicants/${id}/history`),
}

// ── PHI (Public Health Inspector) ────────────────────────────────────────────
export const phiApi = {
  pendingInspections: () => api.get('/phi/pending-inspections'),
  signInspection:     (id: string, data: any) => api.put(`/phi/inspections/${id}/sign`, data),
  pendingCOR:         () => api.get('/phi/pending-cor'),
  signCOR:            (id: string, data: any) => api.put(`/phi/cor/${id}/sign`, data),
}

// ── Fee Configuration Management (Admin) ─────────────────────────────────────
export const feeConfigApi = {
  getAll:        () => api.get('/fee-configurations'),
  getById:       (id: string) => api.get(`/fee-configurations/${id}`),
  getByPlanType: (id: string) => api.get(`/fee-configurations/plan-type/${id}`),
  create:        (data: any) => api.post('/fee-configurations', data),
  update:        (id: string, data: any) => api.put(`/fee-configurations/${id}`, data),
  deactivate:    (id: string) => api.delete(`/fee-configurations/${id}`),
}

// ── Tax Record Import (Admin/PSO) ─────────────────────────────────────────────
export const taxImportApi = {
  upload:   (formData: FormData) =>
    api.post('/tax-import/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  validate: (formData: FormData) =>
    api.post('/tax-import/validate', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  preview:  (formData: FormData) =>
    api.post('/tax-import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  confirm:  (formData: FormData) =>
    api.post('/tax-import/confirm', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  history:  () => api.get('/tax-import/history'),
}

// ── PC Attendees ──────────────────────────────────────────────────────────────
export const pcAttendeeApi = {
  addAttendee:      (meetingId: string, data: any) => api.post(`/pc-attendees/meetings/${meetingId}/attendees`, data),
  getByMeeting:     (meetingId: string) => api.get(`/pc-attendees/meetings/${meetingId}/attendees`),
  updateAttendance: (meetingId: string, attendeeId: string, data: any) =>
    api.put(`/pc-attendees/meetings/${meetingId}/attendees/${attendeeId}/attendance`, data),
  saveNotes:        (meetingId: string, attendeeId: string, data: any) =>
    api.put(`/pc-attendees/meetings/${meetingId}/attendees/${attendeeId}/notes`, data),
  verifyQuorum:     (meetingId: string) => api.get(`/pc-attendees/meetings/${meetingId}/quorum`),
  remove:           (meetingId: string, attendeeId: string) =>
    api.delete(`/pc-attendees/meetings/${meetingId}/attendees/${attendeeId}`),
  recordAttendance: (meetingId: string, attendeeId: string, data: any) =>
    api.put(`/pc-attendees/meetings/${meetingId}/attendees/${attendeeId}/record`, data),
  getByOfficer:     (officerId: string) => api.get(`/pc-attendees/officer/${officerId}`),
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const auditLogApi = {
  search:      (params?: any) => api.get('/audit-logs', { params }),
  getByRef:    (ref: string) => api.get(`/audit-logs/ref/${ref}`),
  getByUser:   (userId: string) => api.get(`/audit-logs/user/${userId}`),
  getByAction: (action: string) => api.get(`/audit-logs/action/${action}`),
  byDateRange: (params: any) => api.get('/audit-logs/date-range', { params }),
  exportLogs:  (params: any) => api.post('/audit-logs/export', params),
}

// ── Password Change Requests ──────────────────────────────────────────────────
export const passwordChangeApi = {
  submit:      (new_password: string) => api.post('/password-change-requests', { new_password }),
  myRequest:   () => api.get('/password-change-requests/my'),
  listPending: () => api.get('/password-change-requests'),
  approve:     (id: string) => api.put(`/password-change-requests/${id}/approve`),
  reject:      (id: string, reason?: string) => api.put(`/password-change-requests/${id}/reject`, { reason }),
}

// ── Tax Owners ────────────────────────────────────────────────────────────────
export const taxOwnerApi = {
  getByTaxRecord: (id: string) => api.get(`/tax-owners/tax-records/${id}/owners`),
}