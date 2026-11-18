const express = require('express');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createBookingSchema,
  queryBookingSchema,
  assignBookingSchema,
  bookingStatusUpdateSchema,
} = require('../validators/booking.schema');
const {
  listBookingsCtrl,
  getBookingCtrl,
  createBookingCtrl,
  assignBookingCtrl,
  updateBookingStatusCtrl,
  generateInvoiceCtrl,
} = require('../controllers/booking.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(queryBookingSchema, 'query'), listBookingsCtrl);
router.post('/', authorizeRole('customer'), validate(createBookingSchema), createBookingCtrl);
router.get('/:id', getBookingCtrl);
router.patch('/:id/assign', authorizeRole('admin'), validate(assignBookingSchema), assignBookingCtrl);
router.patch(
  '/:id/status',
  authorizeRole('admin', 'driver'),
  validate(bookingStatusUpdateSchema),
  updateBookingStatusCtrl
);
router.post('/:id/invoice', authorizeRole('admin'), generateInvoiceCtrl);

module.exports = router;
