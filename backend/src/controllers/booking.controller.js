const bookingService = require('../services/booking.service');

async function listBookingsCtrl(req, res, next) {
  try {
    const result = await bookingService.listBookings(req.user, req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getBookingCtrl(req, res, next) {
  try {
    const result = await bookingService.getBooking(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function createBookingCtrl(req, res, next) {
  try {
    const result = await bookingService.createBooking(req.body, req.user);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function assignBookingCtrl(req, res, next) {
  try {
    const result = await bookingService.assignBooking(
      req.params.id,
      req.body.trip_id,
      req.user
    );
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function updateBookingStatusCtrl(req, res, next) {
  try {
    const result = await bookingService.updateBookingStatus(
      req.params.id,
      req.body.status,
      req.user
    );
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function generateInvoiceCtrl(req, res, next) {
  try {
    const result = await bookingService.generateInvoice(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listBookingsCtrl,
  getBookingCtrl,
  createBookingCtrl,
  assignBookingCtrl,
  updateBookingStatusCtrl,
  generateInvoiceCtrl,
};
