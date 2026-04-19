/**
 * notificationEvents.service.js
 *
 * Central event → recipients → channels map.
 * Added: POST_APPROVAL_COMPLAINT event.
 */

const notifService = require('./notification.service');

const emit = async (eventType, context = {}) => {
  const {
    referenceNumber, applicantId, swId, toId, psoId, chairmanId,
    applicantEmail, applicantPhone,
  } = context;

  const events = {
    APPLICATION_SUBMITTED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Application Submitted', body: `Your application ${referenceNumber} has been submitted successfully.` },
      { recipient_id: psoId, channel: 'IN_APP', title: 'New Application', body: `New application ${referenceNumber} is awaiting your review.` },
    ],
    REFERENCE_NUMBER_ISSUED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Reference Number Issued', body: `Your reference number is ${referenceNumber}. Please keep this for your records.` },
      { recipient_id: applicantId, channel: 'EMAIL', title: 'Reference Number Issued', body: `Your planning application reference number is ${referenceNumber}.`, metadata: { email: applicantEmail } },
    ],
    INSPECTION_SCHEDULED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Inspection Scheduled', body: `A site inspection for ${referenceNumber} has been scheduled. Check your messages for date and time.` },
      { recipient_id: applicantId, channel: 'SMS', title: 'Inspection Scheduled', body: `PS: Site inspection scheduled for ${referenceNumber}. Log in to confirm the date.`, metadata: { phone: applicantPhone } },
    ],
    DECISION_MADE: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Decision Made', body: `The Planning Committee has made a decision on your application ${referenceNumber}. Please log in to view.` },
      { recipient_id: applicantId, channel: 'EMAIL', title: 'Planning Application Decision', body: `A decision has been made on application ${referenceNumber}. Log in to the Pradeshiya Sabha portal to view details.`, metadata: { email: applicantEmail } },
    ],
    FINE_ISSUED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Fine Issued', body: `An unauthorized construction fine has been issued for ${referenceNumber}. Payment is required before your application can proceed.` },
      { recipient_id: psoId,       channel: 'IN_APP', title: 'Fine Issued', body: `Fine issued on application ${referenceNumber}. Awaiting payment.` },
      { recipient_id: swId,        channel: 'IN_APP', title: 'Fine Issued', body: `Fine issued on application ${referenceNumber}.` },
    ],
    COMPLAINT_FILED: [
      { recipient_id: swId,       channel: 'IN_APP', title: 'Complaint Filed', body: `A complaint has been filed linked to ${referenceNumber || 'a tax record'}.` },
      { recipient_id: toId,       channel: 'IN_APP', title: 'Complaint Filed', body: `A complaint requires your attention. Reference: ${referenceNumber}.` },
      { recipient_id: psoId,      channel: 'IN_APP', title: 'Complaint Filed', body: `A complaint has been filed. Reference: ${referenceNumber}.` },
      { recipient_id: chairmanId, channel: 'IN_APP', title: 'Complaint Filed', body: `A public complaint has been filed. Reference: ${referenceNumber}.` },
    ],
    POST_APPROVAL_COMPLAINT: [
      { recipient_id: swId,       channel: 'IN_APP', title: `⚠ Post-Approval Complaint — ${referenceNumber}`, body: `A complaint was filed within 5 hours of approval for ${referenceNumber}. Urgent attention required.` },
      { recipient_id: swId,       channel: 'EMAIL',  title: `⚠ Post-Approval Complaint — ${referenceNumber}`, body: `A public complaint has been filed within 5 hours of approving application ${referenceNumber}. Please review immediately.` },
      { recipient_id: toId,       channel: 'IN_APP', title: `⚠ Post-Approval Complaint — ${referenceNumber}`, body: `A complaint was filed on an application you inspected (${referenceNumber}). Please review.` },
      { recipient_id: toId,       channel: 'EMAIL',  title: `⚠ Post-Approval Complaint — ${referenceNumber}`, body: `A post-approval complaint has been filed for ${referenceNumber}. You are the responsible Technical Officer.` },
      { recipient_id: chairmanId, channel: 'IN_APP', title: `⚠ Post-Approval Complaint — ${referenceNumber}`, body: `A public complaint was filed within 5 hours of approval. Reference: ${referenceNumber}.` },
      { recipient_id: chairmanId, channel: 'EMAIL',  title: `⚠ Post-Approval Complaint — ${referenceNumber}`, body: `Chairman Alert: A post-approval complaint has been filed for ${referenceNumber}. Please review.` },
    ],
    COR_ISSUED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Certificate of Conformity Issued', body: `Your Certificate of Conformity (COC) for ${referenceNumber} has been issued. Please collect it at the Pradeshiya Sabha office.` },
      { recipient_id: applicantId, channel: 'EMAIL', title: 'Certificate of Conformity Issued', body: `Your COC for ${referenceNumber} is ready for collection at the Kelaniya Pradeshiya Sabha office.`, metadata: { email: applicantEmail } },
    ],
    TASK_ASSIGNED: [
      { recipient_id: toId, channel: 'IN_APP', title: 'New Task Assigned', body: `You have been assigned to inspect application ${referenceNumber}. Please schedule your site visit.` },
    ],
    REPRINT_NOTIFICATION: [
      { recipient_id: chairmanId, channel: 'IN_APP', title: 'Certificate Reprint Alert', body: `A reprint has been requested for a certificate on ${referenceNumber}. Please review in the audit log.` },
    ],
    COUNTER_SLOT_PROPOSED: [
      { recipient_id: toId,       channel: 'IN_APP', title: 'Counter-Slot Proposed', body: `The applicant has proposed an alternative inspection time for ${referenceNumber}. Please review and respond.` },
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Counter-Slot Submitted', body: `Your alternative inspection slot for ${referenceNumber} has been submitted to the Technical Officer.` },
    ],
    SLOT_ACCEPTED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Inspection Slot Confirmed', body: `Your inspection slot for ${referenceNumber} has been confirmed. Please ensure you or your representative is present at the site.` },
      { recipient_id: applicantId, channel: 'SMS',    title: 'Inspection Confirmed', body: `PS: Your inspection for ${referenceNumber} is confirmed. Check system for details.`, metadata: { phone: applicantPhone } },
      { recipient_id: toId,        channel: 'IN_APP', title: 'Inspection Slot Confirmed', body: `Inspection slot for ${referenceNumber} confirmed with applicant.` },
    ],
    VOTE_CAST: [
      { recipient_id: chairmanId, channel: 'IN_APP', title: 'Vote Recorded', body: `A Planning Committee member has cast their vote on application ${referenceNumber}.` },
    ],
    FURTHER_REVIEW: [
      { recipient_id: applicantId, channel: 'IN_APP',  title: 'Further Review Required', body: `The Planning Committee has returned your application ${referenceNumber} for further review. An officer will contact you with specific requirements. Please log in to check the tracking line.` },
      { recipient_id: applicantId, channel: 'EMAIL',   title: 'Further Review Required', body: `The Planning Committee has returned application ${referenceNumber} for further review. Please log in to the Pradeshiya Sabha portal to view the requirements.`, metadata: { email: applicantEmail } },
    ],
    EXPIRY_REMINDER_MANUAL: [
      { recipient_id: applicantId, channel: 'IN_APP',  title: 'Planning Approval Expiry Reminder', body: `Your planning approval (Ref: ${referenceNumber}) is approaching its expiry date. Please apply for a time extension if construction is not yet complete.` },
      { recipient_id: applicantId, channel: 'EMAIL',   title: 'Planning Approval Expiry Reminder', body: `Reminder: Your planning approval (Ref: ${referenceNumber}) may be approaching expiry. Log in to check the status and apply for an extension if needed.`, metadata: { email: applicantEmail } },
    ],

    TIME_EXTENSION_REQUESTED: [
      { recipient_id: chairmanId, channel: 'IN_APP', title: 'Time Extension Requested', body: `Applicant has requested a time extension for ${referenceNumber}. Payment required before processing.` },
      { recipient_id: swId,       channel: 'IN_APP', title: 'Time Extension Requested', body: `Time extension request received for ${referenceNumber}.` },
      { recipient_id: psoId,      channel: 'IN_APP', title: 'Time Extension Request', body: `New extension request for ${referenceNumber}. Awaiting payment.` },
      { recipient_id: toId,       channel: 'IN_APP', title: 'Time Extension Requested', body: `The applicant for ${referenceNumber} has requested a time extension.` },
    ],
    DOCUMENT_ISSUE_NOTIFIED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Action Required: Document Issue', body: `Your application (Tax No: ${referenceNumber}) has a document issue. Please log in to review the PSO note and resubmit the required documents.` },
      { recipient_id: applicantId, channel: 'EMAIL',  title: 'Document Issue — Action Required', body: `Your planning application has been placed in the Document Issue queue. Please log in to review the note and upload corrected documents.`, metadata: { email: applicantEmail } },
    ],
    NAME_MISMATCH_NOTIFIED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Name Verification Issue', body: `Your application has a name mismatch with the assessment tax record (Tax No: ${referenceNumber}). The PSO will contact you to resolve this.` },
      { recipient_id: applicantId, channel: 'EMAIL',  title: 'Name Mismatch — Pradeshiya Sabha', body: `Your application's name does not match the assessment tax records. Please contact the Pradeshiya Sabha office.`, metadata: { email: applicantEmail } },
    ],
    APPLICATION_APPROVED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: '🎉 Application Approved! Payment Required', body: `Your planning application ${referenceNumber} has been APPROVED. Please log in to pay the approval fee to receive your certificate.` },
      { recipient_id: applicantId, channel: 'EMAIL',  title: `Application Approved — ${referenceNumber}`, body: `Congratulations! Your planning application ${referenceNumber} has been approved. Please log in to pay the approval fee.`, metadata: { email: applicantEmail } },
      { recipient_id: psoId,       channel: 'IN_APP', title: 'Application Approved — Awaiting Certificate', body: `Application ${referenceNumber} approved. Generate and issue the approval certificate.` },
    ],
    CERTIFICATE_READY: [
      { recipient_id: applicantId, channel: 'IN_APP', title: '📜 Certificate Ready for Collection', body: `Your approval certificate for ${referenceNumber} has been signed and is ready. Please collect it at the Pradeshiya Sabha office.` },
      { recipient_id: applicantId, channel: 'EMAIL',  title: `Certificate Ready — ${referenceNumber}`, body: `Your planning approval certificate for ${referenceNumber} is ready for collection. Office hours: Mon-Fri 8AM-4PM.`, metadata: { email: applicantEmail } },
    ],
    COR_REQUESTED: [
      { recipient_id: toId,       channel: 'IN_APP', title: 'COR Inspection Required', body: `Applicant has applied for Certificate of Residence for ${referenceNumber}. Schedule the final inspection.` },
      { recipient_id: swId,       channel: 'IN_APP', title: 'COR Application Received', body: `COR application received for ${referenceNumber}. Assign final inspection to the original TO.` },
    ],
    EXTENSION_APPROVED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: '✅ Time Extension Approved', body: `Your time extension request for ${referenceNumber} has been approved. New expiry date has been updated.` },
      { recipient_id: applicantId, channel: 'EMAIL',  title: `Extension Approved — ${referenceNumber}`, body: `Your time extension for ${referenceNumber} has been approved. Please log in to view the new expiry date.`, metadata: { email: applicantEmail } },
    ],
    INSPECTION_RESCHEDULED: [
      { recipient_id: applicantId, channel: 'IN_APP', title: 'Inspection Rescheduled', body: `The site inspection for ${referenceNumber} has been rescheduled. Please log in to view the new date.` },
      { recipient_id: applicantId, channel: 'SMS',    title: 'Inspection Rescheduled', body: `PS: Inspection for ${referenceNumber} rescheduled. Log in to confirm.`, metadata: { phone: applicantPhone } },
    ],
    RESUBMISSION_RECEIVED: [
      { recipient_id: psoId, channel: 'IN_APP', title: 'Resubmission Received', body: `Applicant has resubmitted documents for ${referenceNumber}. Application moved to resubmission queue.` },
    ],
    UDA_MEETING_SCHEDULED: [
      { recipient_id: chairmanId, channel: 'IN_APP', title: 'PC Meeting Scheduled', body: `A Planning Committee meeting has been scheduled. ${referenceNumber || 'Please log in to view details.'}` },
    ],

    APPEAL_UPDATE: [
      { recipient_id: applicantId, channel: 'IN_APP',  title: 'Appeal Status Update', body: `There has been an update on your appeal for application ${referenceNumber}. Please log in to view the current status.` },
      { recipient_id: applicantId, channel: 'EMAIL',   title: 'Appeal Status Update', body: `Your appeal for application ${referenceNumber} has been updated. Log in to the Pradeshiya Sabha portal for details.`, metadata: { email: applicantEmail } },
    ],
    APPEAL_ASSIGNED: [
      { recipient_id: applicantId, channel: 'IN_APP',  title: 'Appeal Assigned for Review', body: `Your appeal for application ${referenceNumber} has been assigned for review. You will be notified of the outcome.` },
      { recipient_id: swId,        channel: 'IN_APP',  title: 'Appeal Assigned', body: `An appeal for application ${referenceNumber} has been assigned for your review.` },
    ],
    QUEUE_ISSUE: [
      { recipient_id: applicantId, channel: 'IN_APP',  title: 'Action Required on Your Application', body: `Your application (Tax No: ${referenceNumber}) has been reviewed by the Pradeshiya Sabha. Action is required. Please log in to view the details and PSO note.` },
      { recipient_id: applicantId, channel: 'EMAIL',   title: 'Action Required on Your Application', body: `Your planning application requires your attention. Please log in to the Pradeshiya Sabha portal to view the issue and required corrective action.`, metadata: { email: applicantEmail } },
      { recipient_id: applicantId, channel: 'SMS',     title: 'Action Required', body: `PS: Your planning application requires action. Log in to portal for details.`, metadata: { phone: applicantPhone } },
    ],
    SW_COMPLAINT_ALERT: [
      { recipient_id: swId,        channel: 'IN_APP',  title: 'Complaint Application in Queue', body: `An application (Tax No: ${referenceNumber}) with active complaints has been allocated to the complaint queue. Please assign a Technical Officer for priority inspection.` },
      { recipient_id: swId,        channel: 'EMAIL',   title: 'Complaint Application Alert', body: `A planning application linked to tax number ${referenceNumber} has active resident complaints. Please log in and assign a Technical Officer immediately.` },
    ],
    VOTE_CAST_EMIT: [
      { recipient_id: chairmanId,  channel: 'IN_APP',  title: 'Planning Committee Vote Cast', body: `A committee member has cast their vote on application ${referenceNumber}. Log in to view the current tally.` },
    ],
  };

  const notifications = (events[eventType] || []).filter(n => n.recipient_id);
  return Promise.all(
    notifications.map(n =>
      notifService.dispatch({ ...n, event_type: eventType, reference_number: referenceNumber })
    )
  );
};

module.exports = { emit };
