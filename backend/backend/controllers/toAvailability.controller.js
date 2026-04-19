const { TOAvailability, User } = require('../models');
const { Op } = require('sequelize');
const { success, created, notFound, badRequest, error } = require('../utils/responseHelper');

// ── TO sets their own availability ────────────────────────────────────────────
exports.setAvailability = async (req, res, next) => {
  try {
    const officer_id = req.user.user_id;
    const { date, is_available, start_time, end_time, slots_remaining, block_reason } = req.body;
    if (!date) return badRequest(res, 'date is required');

    const [record] = await TOAvailability.findOrCreate({
      where: { officer_id, date },
      defaults: { officer_id, date, is_available: true, start_time: '08:00', end_time: '17:00', slots_remaining: 3 },
    });
    await record.update({ is_available, start_time, end_time, slots_remaining, block_reason });
    return success(res, record, 'Availability updated');
  } catch (err) { next(err); }
};

// ── SW checks TO availability before assigning ────────────────────────────────
exports.checkAvailability = async (req, res, next) => {
  try {
    const { officer_id, date } = req.params;
    const record = await TOAvailability.findOne({ where: { officer_id, date } });
    // Default: available if no record found (TO has not blocked the day)
    if (!record) return success(res, { officer_id, date, is_available: true, slots_remaining: 3 });
    return success(res, { officer_id, date,
      is_available:    record.is_available,
      start_time:      record.start_time,
      end_time:        record.end_time,
      slots_remaining: record.slots_remaining,
      block_reason:    record.block_reason,
    });
  } catch (err) { next(err); }
};

// ── Get available TOs for a given date ───────────────────────────────────────
exports.getAvailableTOs = async (req, res, next) => {
  try {
    const { date } = req.params;
    // All active TOs
    const allTOs = await User.findAll({
      where: { role: 'TO', status: 'ACTIVE' },
      attributes: ['user_id','email'],
    });

    // Blocked TOs for this date
    const blocked = await TOAvailability.findAll({
      where: { date, [Op.or]: [{ is_available: false }, { slots_remaining: 0 }] },
      attributes: ['officer_id'],
    });
    const blockedSet = new Set(blocked.map(b => b.officer_id));

    // Availability records for this date (with remaining slots)
    const available = await TOAvailability.findAll({
      where: { date, is_available: true, slots_remaining: { [Op.gt]: 0 } },
      attributes: ['officer_id','slots_remaining','start_time','end_time'],
    });
    const availMap = {};
    available.forEach(a => { availMap[a.officer_id] = a; });

    const result = allTOs.map(to => ({
      user_id:         to.user_id,
      email:           to.email,
      is_available:    !blockedSet.has(to.user_id),
      slots_remaining: availMap[to.user_id]?.slots_remaining ?? 3,
      start_time:      availMap[to.user_id]?.start_time ?? '08:00',
      end_time:        availMap[to.user_id]?.end_time   ?? '17:00',
    }));

    return success(res, result);
  } catch (err) { next(err); }
};

// ── Decrement slot when inspection is booked ──────────────────────────────────
exports.bookSlot = async (req, res, next) => {
  try {
    const { officer_id, date } = req.body;
    if (!officer_id || !date) return badRequest(res, 'officer_id and date are required');

    const [record] = await TOAvailability.findOrCreate({
      where: { officer_id, date },
      defaults: { officer_id, date, is_available: true, slots_remaining: 3 },
    });

    if (!record.is_available || record.slots_remaining <= 0) {
      return badRequest(res, 'This TO has no available slots on ' + date);
    }

    await record.update({
      slots_remaining: record.slots_remaining - 1,
      is_available:    record.slots_remaining - 1 > 0,
    });

    return success(res, { slots_remaining: record.slots_remaining - 1 }, 'Slot booked');
  } catch (err) { next(err); }
};

// ── TO views their own calendar ───────────────────────────────────────────────
exports.getMyCalendar = async (req, res, next) => {
  try {
    const officer_id = req.user.user_id;
    const { from, to } = req.query;
    const where = { officer_id };
    if (from && to) {
      const { Op } = require('sequelize');
      where.date = { [Op.between]: [from, to] };
    }
    const records = await TOAvailability.findAll({ where, order: [['date','ASC']] });
    return success(res, records);
  } catch (err) { next(err); }
};
