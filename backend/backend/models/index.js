const sequelize = require('../config/database');

// Load all models
const PasswordChangeRequest = require('./passwordChangeRequest.model');
const User = require('./user.model');
const Applicant = require('./applicant.model');
const Officer = require('./officer.model');
const AssessmentTaxRecord = require('./assessmentTaxRecord.model');
const TaxRecordOwner = require('./taxRecordOwner.model');
const TaxOwnerChangeHistory = require('./taxOwnerChangeHistory.model');
const PlanType = require('./planType.model');
const FeeConfiguration = require('./feeConfiguration.model');
const Application = require('./application.model');
const Document = require('./document.model');
const PSOVerificationLog = require('./psoVerificationLog.model');
const Queue = require('./queue.model');
const QueueAssignment = require('./queueAssignment.model');
const Complaint = require('./complaint.model');
const Payment = require('./payment.model');
const TaskAssignment = require('./taskAssignment.model');
const Inspection = require('./inspection.model');
const InspectionMinute = require('./inspectionMinute.model');
const Fine = require('./fine.model');
const Minute = require('./minute.model');
const Message = require('./message.model');
const ExternalApproval = require('./externalApproval.model');
const Agreement = require('./agreement.model');
const PlanningCommitteeMeeting = require('./planningCommitteeMeeting.model');
const PCApplication = require('./pcApplication.model');
const PCAttendee = require('./pcAttendee.model');
const Decision = require('./decision.model');
const ApprovalCertificate = require('./approvalCertificate.model');
const CertificatePrintLog = require('./certificatePrintLog.model');
const TimeExtension = require('./timeExtension.model');
const Appeal = require('./appeal.model');
const CORApplication = require('./corApplication.model');
const FinalInspection = require('./finalInspection.model');
const CORCertificate = require('./corCertificate.model');
const TrackingLine = require('./trackingLine.model');
const TrackingNode = require('./trackingNode.model');
const Notification = require('./notification.model');
const AuditLog = require('./auditLog.model');
const OTP      = require('./otp.model');
const TOAvailability = require('./toAvailability.model');

// ─── Associations ─────────────────────────────────────────────────────────────

// User ↔ Applicant / Officer
User.hasOne(Applicant, { foreignKey: 'user_id' });
Applicant.belongsTo(User, { foreignKey: 'user_id' });

User.hasOne(Officer, { foreignKey: 'user_id' });
Officer.belongsTo(User, { foreignKey: 'user_id' });

// AssessmentTaxRecord ↔ Owners
AssessmentTaxRecord.hasMany(TaxRecordOwner, { foreignKey: 'tax_record_id' });
TaxRecordOwner.belongsTo(AssessmentTaxRecord, { foreignKey: 'tax_record_id' });

AssessmentTaxRecord.hasMany(TaxOwnerChangeHistory, { foreignKey: 'tax_record_id' });
TaxOwnerChangeHistory.belongsTo(AssessmentTaxRecord, { foreignKey: 'tax_record_id' });

// Application associations
Applicant.hasMany(Application, { foreignKey: 'applicant_id' });
Application.belongsTo(Applicant, { foreignKey: 'applicant_id' });

AssessmentTaxRecord.hasMany(Application, { foreignKey: 'tax_record_id' });
Application.belongsTo(AssessmentTaxRecord, { foreignKey: 'tax_record_id' });

PlanType.hasMany(Application, { foreignKey: 'plan_type_id', as: 'Applications' });
Application.belongsTo(PlanType, { foreignKey: 'plan_type_id', as: 'PlanType' });

// FeeConfiguration ↔ PlanType
PlanType.hasMany(FeeConfiguration, { foreignKey: 'plan_type_id' });
FeeConfiguration.belongsTo(PlanType, { foreignKey: 'plan_type_id' });

// Documents
Application.hasMany(Document, { foreignKey: 'application_id' });
Document.belongsTo(Application, { foreignKey: 'application_id' });

Document.hasOne(Document, { foreignKey: 'superseded_by', as: 'NextVersion' });
Document.belongsTo(Document, { foreignKey: 'superseded_by', as: 'PreviousVersion' });

// PSO Verification Log
Application.hasMany(PSOVerificationLog, { foreignKey: 'application_id' });
PSOVerificationLog.belongsTo(Application, { foreignKey: 'application_id' });

// Queue Assignments
Queue.hasMany(QueueAssignment, { foreignKey: 'queue_id' });
QueueAssignment.belongsTo(Queue, { foreignKey: 'queue_id' });

Application.hasMany(QueueAssignment, { foreignKey: 'application_id' });
QueueAssignment.belongsTo(Application, { foreignKey: 'application_id' });

// Complaints
AssessmentTaxRecord.hasMany(Complaint, { foreignKey: 'tax_number', sourceKey: 'tax_number' });
Complaint.belongsTo(AssessmentTaxRecord, { foreignKey: 'tax_number', targetKey: 'tax_number' });

// Payments
Application.hasMany(Payment, { foreignKey: 'application_id' });
Payment.belongsTo(Application, { foreignKey: 'application_id' });

// Task Assignments
Application.hasMany(TaskAssignment, { foreignKey: 'application_id' });
TaskAssignment.belongsTo(Application, { foreignKey: 'application_id' });

Officer.hasMany(TaskAssignment, { foreignKey: 'assigned_to' });
TaskAssignment.belongsTo(Officer, { foreignKey: 'assigned_to', as: 'AssignedOfficer' });

// Inspections
Application.hasMany(Inspection, { foreignKey: 'application_id' });
Inspection.belongsTo(Application, { foreignKey: 'application_id' });

TaskAssignment.hasMany(Inspection, { foreignKey: 'task_id' });
Inspection.belongsTo(TaskAssignment, { foreignKey: 'task_id' });

// Inspection Minutes
Inspection.hasOne(InspectionMinute, { foreignKey: 'inspection_id' });
InspectionMinute.belongsTo(Inspection, { foreignKey: 'inspection_id' });

// Fines
Application.hasMany(Fine, { foreignKey: 'application_id' });
Fine.belongsTo(Application, { foreignKey: 'application_id' });

// Minutes
Application.hasMany(Minute, { foreignKey: 'application_id' });
Minute.belongsTo(Application, { foreignKey: 'application_id' });

// External Approvals
Application.hasMany(ExternalApproval, { foreignKey: 'application_id' });
ExternalApproval.belongsTo(Application, { foreignKey: 'application_id' });

ExternalApproval.hasOne(Agreement, { foreignKey: 'external_approval_id' });
Agreement.belongsTo(ExternalApproval, { foreignKey: 'external_approval_id' });

// PC Meetings
PlanningCommitteeMeeting.hasMany(PCApplication, { foreignKey: 'meeting_id' });
PCApplication.belongsTo(PlanningCommitteeMeeting, { foreignKey: 'meeting_id' });

Application.hasMany(PCApplication, { foreignKey: 'application_id' });
PCApplication.belongsTo(Application, { foreignKey: 'application_id' });

PlanningCommitteeMeeting.hasMany(PCAttendee, { foreignKey: 'meeting_id' });
PCAttendee.belongsTo(PlanningCommitteeMeeting, { foreignKey: 'meeting_id' });

// Decisions
Application.hasMany(Decision, { foreignKey: 'application_id' });
Decision.belongsTo(Application, { foreignKey: 'application_id' });

PlanningCommitteeMeeting.hasMany(Decision, { foreignKey: 'meeting_id' });
Decision.belongsTo(PlanningCommitteeMeeting, { foreignKey: 'meeting_id' });

// Approval Certificates
Decision.hasOne(ApprovalCertificate, { foreignKey: 'decision_id' });
ApprovalCertificate.belongsTo(Decision, { foreignKey: 'decision_id' });

Application.hasOne(ApprovalCertificate, { foreignKey: 'application_id' });
ApprovalCertificate.belongsTo(Application, { foreignKey: 'application_id' });

// Print Logs
ApprovalCertificate.hasMany(CertificatePrintLog, { foreignKey: 'certificate_id' });
CertificatePrintLog.belongsTo(ApprovalCertificate, { foreignKey: 'certificate_id' });

// Time Extensions
Application.hasMany(TimeExtension, { foreignKey: 'application_id' });
TimeExtension.belongsTo(Application, { foreignKey: 'application_id' });

// Appeals
Application.hasMany(Appeal, { foreignKey: 'application_id' });
Appeal.belongsTo(Application, { foreignKey: 'application_id' });

Decision.hasMany(Appeal, { foreignKey: 'original_decision_id' });
Appeal.belongsTo(Decision, { foreignKey: 'original_decision_id', as: 'OriginalDecision' });

// COR
Application.hasMany(CORApplication, { foreignKey: 'application_id' });
CORApplication.belongsTo(Application, { foreignKey: 'application_id' });

CORApplication.hasOne(FinalInspection, { foreignKey: 'cor_application_id' });
FinalInspection.belongsTo(CORApplication, { foreignKey: 'cor_application_id' });

CORApplication.hasOne(CORCertificate, { foreignKey: 'cor_application_id' });
CORCertificate.belongsTo(CORApplication, { foreignKey: 'cor_application_id' });

// Tracking
Application.hasOne(TrackingLine, { foreignKey: 'application_id' });
TrackingLine.belongsTo(Application, { foreignKey: 'application_id' });

TrackingLine.hasMany(TrackingNode, { foreignKey: 'tracking_line_id', as: 'nodes' });
TrackingNode.belongsTo(TrackingLine, { foreignKey: 'tracking_line_id', as: 'trackingLine' });

// Notifications
User.hasMany(Notification, { foreignKey: 'recipient_id' });
Notification.belongsTo(User, { foreignKey: 'recipient_id' });

// Audit Logs
User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

// PasswordChangeRequest associations
PasswordChangeRequest.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
User.hasMany(PasswordChangeRequest, { foreignKey: 'user_id', as: 'PasswordChangeRequests' });

module.exports = {
  sequelize,
  User, Applicant, Officer,
  AssessmentTaxRecord, TaxRecordOwner, TaxOwnerChangeHistory,
  PlanType, FeeConfiguration,
  Application, Document, PSOVerificationLog,
  Queue, QueueAssignment,
  Complaint, Payment,
  TaskAssignment, Inspection, InspectionMinute,
  Fine, Minute, Message,
  ExternalApproval, Agreement,
  PlanningCommitteeMeeting, PCApplication, PCAttendee,
  Decision, ApprovalCertificate, CertificatePrintLog,
  TimeExtension, Appeal,
  CORApplication, FinalInspection, CORCertificate,
  TrackingLine, TrackingNode,
  Notification, AuditLog,
  OTP,
  PasswordChangeRequest, TOAvailability,
};
