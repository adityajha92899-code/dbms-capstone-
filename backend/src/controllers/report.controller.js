const reportService = require('../services/report.service');

async function getKpisCtrl(_req, res, next) {
  try {
    const result = await reportService.getKpis();
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getFuelEfficiencyCtrl(req, res, next) {
  try {
    const result = await reportService.getFuelEfficiency(req.query);
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function getMaintenanceCostCtrl(req, res, next) {
  try {
    const result = await reportService.getMaintenanceCost(req.query);
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function getRevenueCtrl(req, res, next) {
  try {
    const result = await reportService.getRevenue(req.query);
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function getTripVolumeCtrl(req, res, next) {
  try {
    const result = await reportService.getTripVolume(req.query);
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function getDriverLeaderboardCtrl(_req, res, next) {
  try {
    const result = await reportService.getDriverLeaderboard();
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function exportAllCsvCtrl(_req, res, next) {
  try {
    const result = await reportService.exportAllCsv();
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getKpisCtrl,
  getFuelEfficiencyCtrl,
  getMaintenanceCostCtrl,
  getRevenueCtrl,
  getTripVolumeCtrl,
  getDriverLeaderboardCtrl,
  exportAllCsvCtrl,
};
