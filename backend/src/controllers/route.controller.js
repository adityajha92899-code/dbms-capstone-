const routeService = require('../services/route.service');

async function listRoutesCtrl(req, res, next) {
  try {
    const result = await routeService.listRoutes(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getRouteCtrl(req, res, next) {
  try {
    const result = await routeService.getRoute(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function createRouteCtrl(req, res, next) {
  try {
    const result = await routeService.createRoute(req.body);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function updateRouteCtrl(req, res, next) {
  try {
    const result = await routeService.updateRoute(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function softDeleteRouteCtrl(req, res, next) {
  try {
    const result = await routeService.softDeleteRoute(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getRouteStatsCtrl(req, res, next) {
  try {
    const result = await routeService.getRouteStats(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listRoutesCtrl,
  getRouteCtrl,
  createRouteCtrl,
  updateRouteCtrl,
  softDeleteRouteCtrl,
  getRouteStatsCtrl,
};
