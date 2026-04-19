const { Application, Decision, TrackingLine, Applicant } = require('../models');
const applicationService = require('./application.service');
const trackingLineService = require('./trackingLine.service');
const notifEvents        = require('./notificationEvents.service');
const { addYears }       = require('../utils/dateHelpers');

const handleDecisionOutcome = async (decisionId, applicationId, referenceNumber, decidedBy) => {
  const decision = await Decision.findByPk(decisionId);
  if (!decision) throw new Error('Decision not found');

  const line = await TrackingLine.findOne({ where: { reference_number: referenceNumber } });

  switch (decision.decision_type) {
    case 'APPROVED':
      await applicationService.transition(applicationId, 'APPROVED', decidedBy);
      // Set 5-year approval expiry date (building plans valid for 5 years per requirement)
      await Application.update(
        { approval_date: new Date(), approval_expiry_date: addYears(new Date(), 5) },
        { where: { application_id: applicationId } }
      );
      if (line) await trackingLineService.addNode(line.tracking_line_id, referenceNumber, 'APPROVED', 'Application Approved');
      break;
    case 'CONDITIONALLY_APPROVED':
      await applicationService.transition(applicationId, 'CONDITIONALLY_APPROVED', decidedBy);
      await Application.update(
        { approval_date: new Date(), approval_expiry_date: addYears(new Date(), 5) },
        { where: { application_id: applicationId } }
      );
      if (line) await trackingLineService.addNode(line.tracking_line_id, referenceNumber, 'APPROVED', 'Application Conditionally Approved');
      break;
    case 'REJECTED':
      await applicationService.transition(applicationId, 'REJECTED', decidedBy);
      if (line) await trackingLineService.addNode(line.tracking_line_id, referenceNumber, 'REJECTED', 'Application Rejected');
      break;
    case 'FURTHER_REVIEW':
      await applicationService.transition(applicationId, 'FURTHER_REVIEW', decidedBy);
      if (line) await trackingLineService.addNode(line.tracking_line_id, referenceNumber, 'FURTHER_REVIEW', 'Further Review Required', { linked_decision_id: decisionId });
      // Notify applicant — requirement: applicant must be informed of further review outcome
      setImmediate(async () => {
        try {
          const app = await Application.findOne({ where: { reference_number: referenceNumber } });
          if (app) {
            const applicant = await Applicant.findByPk(app.applicant_id, { attributes: ['user_id'] });
            if (applicant?.user_id) {
              await notifEvents.emit('FURTHER_REVIEW', { referenceNumber, applicantId: applicant.user_id });
            }
          }
        } catch (e) { console.error('[PC WORKFLOW] FURTHER_REVIEW notify error:', e.message); }
      });
      break;
    case 'DEFERRED':
      // INTENTIONAL: application status stays 'PC_REVIEW' when deferred.
      // The deferral is recorded in pc_applications.is_carried_over = true.
      // When the carried-over application is heard at the next meeting,
      // the decision at that point drives the final status transition.
      // The DEFERRED status in the state machine is used only if PSO
      // explicitly calls updateStatus() for historical/override purposes.
      break;
  }
  return decision;
};

const deferToNextMeeting = async (pcApplicationId, newMeetingId) => {
  const { PCApplication } = require('../models');
  return PCApplication.update(
    { is_carried_over: true, carried_from_meeting_id: pcApplicationId, meeting_id: newMeetingId, status: 'CARRIED_OVER' },
    { where: { pc_application_id: pcApplicationId } }
  );
};

module.exports = { handleDecisionOutcome, deferToNextMeeting };
