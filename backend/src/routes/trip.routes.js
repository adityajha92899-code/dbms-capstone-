const express = require('express');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createTripSchema,
  queryTripSchema,
  tripStatusUpdateSchema,
  tripLocationSchema,
} = require('../validators/trip.schema');
const {
  listTripsCtrl,
  getTripCtrl,
  createTripCtrl,
  updateTripStatusCtrl,
  updateTripLocationCtrl,
  getTripTrackingCtrl,
} = require('../controllers/trip.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(queryTripSchema, 'query'), listTripsCtrl);
router.post('/', authorizeRole('admin'), validate(createTripSchema), createTripCtrl);
router.get('/:id', getTripCtrl);
router.patch('/:id/status', validate(tripStatusUpdateSchema), updateTripStatusCtrl);
router.post(
  '/:id/location',
  authorizeRole('driver'),
  validate(tripLocationSchema),
  updateTripLocationCtrl
);
router.get('/:id/tracking', getTripTrackingCtrl);

module.exports = router;
