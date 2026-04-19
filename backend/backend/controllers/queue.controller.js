const { Queue, QueueAssignment, Application } = require('../models');
const { success, created, badRequest, error } = require('../utils/responseHelper');

// Queue types that require a written explanatory note
const NOTE_REQUIRED_TYPES = ['DOCUMENT_ISSUE', 'NAME_MISMATCH'];

exports.getQueueByType = async (req, res, next) => {
  try {
    const items = await QueueAssignment.findAll({
      include: [{ model: Queue, where: { queue_type: req.params.type } }, { model: Application }],
      where: { status: 'PENDING' },
    });
    return success(res, items);
  } catch (err) { next(err); }
};

exports.getAllActiveQueues = async (req, res, next) => {
  try {
    return success(res, await Queue.findAll({ where: { is_active: true } }));
  } catch (err) { next(err); }
};

exports.getOnlineQueue = async (req, res, next) => {
  try {
    const items = await QueueAssignment.findAll({
      include: [{ model: Application, where: { submission_mode: 'ONLINE' }, required: true }],
      where: { status: 'PENDING' }, order: [['sort_order', 'ASC']],
    });
    return success(res, items);
  } catch (err) { next(err); }
};

exports.getManualQueue = async (req, res, next) => {
  try {
    const items = await QueueAssignment.findAll({
      include: [{ model: Application, where: { submission_mode: 'WALK_IN' }, required: true }],
      where: { status: 'PENDING' }, order: [['sort_order', 'ASC']],
    });
    return success(res, items);
  } catch (err) { next(err); }
};

exports.assignToQueue = async (req, res, next) => {
  try {
    const { queue_id, issue_note } = req.body;

    // Resolve the queue type so we can enforce the note rule
    const queue = queue_id ? await Queue.findByPk(queue_id) : null;
    const queueType = queue?.queue_type || req.body.queue_type;

    // Per spec: PSO MUST write an explanatory note for problem queues
    if (NOTE_REQUIRED_TYPES.includes(queueType)) {
      if (!issue_note || !issue_note.trim()) {
        return badRequest(res,
          `An issue_note is required when assigning to the ${queueType} queue. ` +
          `Describe specifically what the problem is so the applicant can correct it.`
        );
      }
    }

    const assignment = await QueueAssignment.create({
      ...req.body,
      assigned_by: req.user.user_id,
    });
    return created(res, assignment);
  } catch (err) { next(err); }
};

exports.resolveQueueItem = async (req, res, next) => {
  try {
    await QueueAssignment.update(
      { status: 'RESOLVED', resolved_by: req.user.user_id, resolved_at: new Date(), resolution_note: req.body.note },
      { where: { assignment_id: req.params.assignmentId } }
    );
    return success(res, null, 'Queue item resolved');
  } catch (err) { next(err); }
};

exports.getQueueApplications = async (req, res, next) => {
  try {
    const items = await QueueAssignment.findAll({
      where: { queue_id: req.params.queueId, status: 'PENDING' },
      include: [Application],
    });
    return success(res, items);
  } catch (err) { next(err); }
};

exports.getQueueCount = async (req, res, next) => {
  try {
    const count = await QueueAssignment.count({ where: { status: 'PENDING' } });
    return success(res, { count });
  } catch (err) { next(err); }
};

exports.reorderQueue = async (req, res, next) => {
  try {
    const { order } = req.body; // [{ assignment_id, sort_order }]
    await Promise.all(order.map(o =>
      QueueAssignment.update({ sort_order: o.sort_order }, { where: { assignment_id: o.assignment_id } })
    ));
    return success(res, null, 'Queue reordered');
  } catch (err) { next(err); }
};
