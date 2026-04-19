// Sets is_immutable = true on critical records to prevent modification
const lockRecord = async (Model, pk) => {
  const record = await Model.findByPk(pk);
  if (!record) throw new Error('Record not found');
  if (record.is_immutable) return record; // Already locked
  return record.update({ is_immutable: true });
};

const lockMultiple = async (Model, pks) => Promise.all(pks.map(pk => lockRecord(Model, pk)));

module.exports = { lockRecord, lockMultiple };
