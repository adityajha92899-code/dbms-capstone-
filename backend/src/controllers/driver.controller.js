const driverService = require('../services/driver.service');

async function listDriversCtrl(req, res, next) {
  try {
    const result = await driverService.listDrivers(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getDriverCtrl(req, res, next) {
  try {
    const result = await driverService.getDriver(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function createDriverCtrl(req, res, next) {
  try {
    const result = await driverService.createDriver(req.body);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function updateDriverStatusCtrl(req, res, next) {
  try {
    const result = await driverService.updateDriverStatus(req.params.id, req.body.status);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getDriverPerformanceCtrl(req, res, next) {
  try {
    const result = await driverService.getDriverPerformance(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listDriversCtrl,
  getDriverCtrl,
  createDriverCtrl,
  updateDriverStatusCtrl,
  getDriverPerformanceCtrl,
};
