const { InspectionMinute, FinalInspection } = require('../models');

const syncInspectionMinute = async (minuteId, offlineData) => {
  const minute = await InspectionMinute.findByPk(minuteId);
  if (!minute) throw new Error('Inspection minute not found');
  if (minute.is_immutable) throw new Error('This record is locked');

  return minute.update({
    ...offlineData,
    drafted_offline: true,
    synced_at: new Date(),
    offline_draft_data: null,
  });
};

const syncFinalInspection = async (inspectionId, offlineData) => {
  const inspection = await FinalInspection.findByPk(inspectionId);
  if (!inspection) throw new Error('Final inspection not found');

  return inspection.update({ ...offlineData, drafted_offline: true, synced_at: new Date() });
};

module.exports = { syncInspectionMinute, syncFinalInspection };
