const express = require('express');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { Forbidden } = require('../utils/errors');
const {
  queryDriverSchema,
  createDriverSchema,
  updateDriverStatusSchema,
} = require('../validators/driver.schema');
const {
  listDriversCtrl,
  getDriverCtrl,
  createDriverCtrl,
  updateDriverStatusCtrl,
  getDriverPerformanceCtrl,
} = require('../controllers/driver.controller');

const router = express.Router();

function authorizeAdminOrSelfDriver(req, _res, next) {
  if (req.user.role === 'admin') {
    return next();
  }
  if (req.user.role === 'driver' && req.user.driverId === req.params.id) {
    return next();
  }
  return next(
    Forbidden('Only admin or the driver themselves may view performance', 'INSUFFICIENT_ROLE')
  );
}

router.use(authenticate);

router.get('/', authorizeRole('admin'), validate(queryDriverSchema, 'query'), listDriversCtrl);
router.post('/', authorizeRole('admin'), validate(createDriverSchema), createDriverCtrl);
router.get('/:id', authorizeRole('admin'), getDriverCtrl);
router.patch(
  '/:id/status',
  authorizeRole('admin'),
  validate(updateDriverStatusSchema),
  updateDriverStatusCtrl
);
router.get('/:id/performance', authorizeAdminOrSelfDriver, getDriverPerformanceCtrl);

module.exports = router;
