const { TaskAssignment, Officer, Application, User, Inspection } = require('../models');
const notifEvents = require('../services/notificationEvents.service');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');
const { Op } = require('sequelize');

exports.createTask = async (req, res, next) => {
  try {
    // reference_number is required — resolve from application_id if not provided
    let reference_number = req.body.reference_number;
    if (!reference_number && req.body.application_id) {
      const { Application } = require('../models');
      const app = await Application.findByPk(req.body.application_id, { attributes: ['reference_number'] });
      reference_number = app?.reference_number || null;
    }
    if (!reference_number) {
      return badRequest(res, 'reference_number is required and could not be resolved from application_id');
    }
    const snapshot = await Officer.findByPk(req.body.assigned_to, { attributes: ['officer_id','full_name','user_id'] });
    if (!snapshot) return badRequest(res, 'Assigned TO does not exist');

    const task = await TaskAssignment.create({
      ...req.body,
      reference_number,
      assigned_by: req.user.user_id,
      to_workload_snapshot: snapshot,
    });

    if (req.body.application_id) {
      await Application.update(
        { status: 'ASSIGNED_TO_TO' },
        { where: { application_id: req.body.application_id } }
      );
    }

    try {
      await notifEvents.emit('TASK_ASSIGNED', {
        referenceNumber: task.reference_number,
        toId: snapshot.user_id,
      });
    } catch (notifyErr) {
      // Notification failure should not fail task assignment
      console.error('[TASK_ASSIGNED notification failed]', notifyErr.message);
    }

    return created(res, task);
  } catch (err) { next(err); }
};

exports.getByOfficer = async (req, res, next) => {
  try {
    const tasks = await TaskAssignment.findAll({
      where: { assigned_to: req.params.officerId, status: { [Op.in]: ['PENDING','IN_PROGRESS'] } },
      include: [{ model: Application }],
    });
    return success(res, tasks);
  } catch (err) { next(err); }
};

exports.getByRef = async (req, res, next) => {
  try {
    const tasks = await TaskAssignment.findAll({ where: { reference_number: req.params.ref }, order: [['created_at','DESC']] });
    return success(res, tasks);
  } catch (err) { next(err); }
};

exports.getByStatus = async (req, res, next) => {
  try {
    const tasks = await TaskAssignment.findAll({ where: { status: req.params.status } });
    return success(res, tasks);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    await TaskAssignment.update({ status: req.body.status }, { where: { task_id: req.params.id } });
    return success(res, null, 'Status updated');
  } catch (err) { next(err); }
};

exports.completeTask = async (req, res, next) => {
  try {
    await TaskAssignment.update({ status: 'COMPLETED', completed_at: new Date() }, { where: { task_id: req.params.id } });
    return success(res, null, 'Task completed');
  } catch (err) { next(err); }
};

exports.reassignTask = async (req, res, next) => {
  try {
    await TaskAssignment.update({ assigned_to: req.body.new_officer_id, status: 'REASSIGNED', assignment_note: req.body.reason }, { where: { task_id: req.params.id } });
    return success(res, null, 'Task reassigned');
  } catch (err) { next(err); }
};

exports.getSWDashboard = async (req, res, next) => {
  try {
    const officers = await Officer.findAll({
      include: [{ model: User, attributes: ['role'], where: { role: 'TO' }, required: true }],
    });
    const dashboard = await Promise.all(officers.map(async (o) => {
      const tasks = await TaskAssignment.findAll({
        where: { assigned_to: o.officer_id, status: { [Op.in]: ['PENDING','IN_PROGRESS'] } },
        include: [{ model: Application }],
      });

      // Defensive filtering: if an inspection is already COMPLETED for a task/ref,
      // do not count it as active workload even if task status was not updated.
      let activeTasks = tasks;
      if (tasks.length) {
        const taskIds = tasks.map(t => t.task_id);
        const refs = [...new Set(tasks.map(t => t.reference_number).filter(Boolean))];

        const completedWhere = {
          officer_id: o.officer_id,
          status: 'COMPLETED',
          [Op.or]: [
            { task_id: { [Op.in]: taskIds } },
          ],
        };
        if (refs.length) {
          completedWhere[Op.or].push({ reference_number: { [Op.in]: refs } });
        }

        const completedInspections = await Inspection.findAll({
          where: {
            ...completedWhere,
          },
          attributes: ['task_id', 'reference_number'],
        });

        const completedTaskIds = new Set(completedInspections.map(i => i.task_id).filter(Boolean));
        const completedRefs = new Set(completedInspections.map(i => i.reference_number).filter(Boolean));

        activeTasks = tasks.filter(t => !completedTaskIds.has(t.task_id) && !completedRefs.has(t.reference_number));
      }

      const byStage = activeTasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
      return { officer: o, active_tasks: activeTasks.length, tasks_by_stage: byStage, tasks: activeTasks };
    }));
    return success(res, dashboard);
  } catch (err) { next(err); }
};

exports.checkOverdueTasks = async (req, res, next) => {
  try {
    const overdue = await TaskAssignment.findAll({
      where: { due_date: { [Op.lt]: new Date() }, status: { [Op.in]: ['PENDING','IN_PROGRESS'] } },
    });
    return success(res, overdue);
  } catch (err) { next(err); }
};

exports.getWorkloadByOfficer = async (req, res, next) => {
  try {
    const count = await TaskAssignment.count({
      where: { assigned_to: req.params.officerId, status: { [Op.in]: ['PENDING','IN_PROGRESS'] } },
    });
    return success(res, { officer_id: req.params.officerId, workload: count });
  } catch (err) { next(err); }
};

exports.snapshotWorkload = async (req, res, next) => {
  try {
    const officers = await Officer.findAll();
    const snapshots = await Promise.all(officers.map(async (o) => {
      const count = await TaskAssignment.count({
        where: { assigned_to: o.officer_id, status: { [Op.in]: ['PENDING','IN_PROGRESS'] } },
      });
      return { officer_id: o.officer_id, workload: count, snapshotted_at: new Date() };
    }));
    return success(res, snapshots);
  } catch (err) { next(err); }
};

// GET /tasks/mine — tasks assigned to the calling officer
exports.getMyTasks = async (req, res, next) => {
  try {
    const { Officer } = require('../models');
    const officer = await Officer.findOne({ where: { user_id: req.user.user_id } });
    if (!officer) return require('../utils/responseHelper').notFound(res, 'Officer profile not found');
    const tasks = await TaskAssignment.findAll({
      where: { assigned_to: officer.officer_id, status: { [Op.in]: ['PENDING','IN_PROGRESS'] } },
      include: [{ model: Application }],
      order: [['created_at', 'DESC']],
    });
    return success(res, tasks);
  } catch (err) { require('../utils/responseHelper').error(res, err.message); }
};

exports.getByApplicationId = async (req, res, next) => {
  try {
    const tasks = await TaskAssignment.findAll({
      where: { application_id: req.params.applicationId },
      order: [['created_at', 'DESC']],
    });
    return success(res, tasks);
  } catch (err) { next(err); }
};
