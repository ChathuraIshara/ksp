const { Appeal, Application, TrackingLine } = require('../models');
const applicationService = require('./application.service');
const trackingLineService = require('./trackingLine.service');

const createAppealNodes = async (appealId, applicationId, referenceNumber, round) => {
  const line = await TrackingLine.findOne({ where: { reference_number: referenceNumber } });
  if (!line) throw new Error('Tracking line not found');

  const nodes = [
    { type: 'SW_INITIAL', label: `APPEAL ROUND ${round} — SW Review` },
    { type: 'TO_INSPECTION', label: `APPEAL ROUND ${round} — TO Inspection` },
    { type: 'SW_REVIEW', label: `APPEAL ROUND ${round} — SW Final Review` },
    { type: 'PC_COMMITTEE', label: `APPEAL ROUND ${round} — PC Decision` },
  ];

  const created = [];
  for (const n of nodes) {
    const node = await trackingLineService.addNode(
      line.tracking_line_id, referenceNumber, n.type, n.label,
      { linked_officer_id: null }, true, round
    );
    created.push(node);
  }

  await applicationService.transition(applicationId, 'APPEAL_IN_REVIEW');
  return created;
};

module.exports = { createAppealNodes };
