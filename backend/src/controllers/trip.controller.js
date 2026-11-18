const tripService = require('../services/trip.service');

async function listTripsCtrl(req, res, next) {
  try {
    const result = await tripService.listTrips(req.user, req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getTripCtrl(req, res, next) {
  try {
    const result = await tripService.getTrip(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function createTripCtrl(req, res, next) {
  try {
    const result = await tripService.createTrip(req.body, req.user);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function updateTripStatusCtrl(req, res, next) {
  try {
    const result = await tripService.updateStatus(req.params.id, req.body.status, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function updateTripLocationCtrl(req, res, next) {
  try {
    const result = await tripService.updateLocation(req.params.id, req.body, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getTripTrackingCtrl(req, res, next) {
  try {
    const result = await tripService.getTracking(req.params.id, req.user);
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listTripsCtrl,
  getTripCtrl,
  createTripCtrl,
  updateTripStatusCtrl,
  updateTripLocationCtrl,
  getTripTrackingCtrl,
};
