const vehicleService = require('../services/vehicle.service');

async function listVehiclesCtrl(req, res, next) {
  try {
    const result = await vehicleService.listVehicles(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getVehicleCtrl(req, res, next) {
  try {
    const result = await vehicleService.getVehicle(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function createVehicleCtrl(req, res, next) {
  try {
    const result = await vehicleService.createVehicle(req.body);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function updateVehicleCtrl(req, res, next) {
  try {
    const result = await vehicleService.updateVehicle(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function softDeleteVehicleCtrl(req, res, next) {
  try {
    const result = await vehicleService.softDeleteVehicle(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getMaintenanceHistoryCtrl(req, res, next) {
  try {
    const result = await vehicleService.getMaintenanceHistory(req.params.id);
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function addMaintenanceCtrl(req, res, next) {
  try {
    const result = await vehicleService.addMaintenance(req.params.id, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getVehicleStatsCtrl(req, res, next) {
  try {
    const result = await vehicleService.getVehicleStats(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listVehiclesCtrl,
  getVehicleCtrl,
  createVehicleCtrl,
  updateVehicleCtrl,
  softDeleteVehicleCtrl,
  getMaintenanceHistoryCtrl,
  addMaintenanceCtrl,
  getVehicleStatsCtrl,
};
