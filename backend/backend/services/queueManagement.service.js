const { Queue, QueueAssignment } = require('../models');

const QUEUE_TYPE_MAP = {
  VERIFIED: 'VERIFIED',
  DOCUMENT_ISSUE: 'DOCUMENT_ISSUE',
  NAME_MISMATCH: 'NAME_MISMATCH',
  COMPLAINT: 'COMPLAINT',
  RESUBMISSION: 'RESUBMISSION',
};

const routeToQueue = async (applicationId, referenceNumber, verificationOutcome, assignedBy) => {
  const queueType = QUEUE_TYPE_MAP[verificationOutcome];
  if (!queueType) throw new Error(`Unknown verification outcome: ${verificationOutcome}`);

  // Deactivate any previous PENDING assignment for this application
  await QueueAssignment.update(
    { status: 'SUPERSEDED' },
    { where: { application_id: applicationId, status: 'PENDING' } }
  );

  const queue = await Queue.findOne({ where: { queue_type: queueType, is_active: true } });
  if (!queue) throw new Error(`Queue ${queueType} not found`);

  return QueueAssignment.create({
    queue_id: queue.queue_id,
    application_id: applicationId,
    reference_number: referenceNumber,
    assigned_by: assignedBy,
    status: 'PENDING',
  });
};

module.exports = { routeToQueue };
