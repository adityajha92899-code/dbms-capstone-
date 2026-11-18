const express = require('express');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createVehicleSchema,
  updateVehicleSchema,
  queryVehicleSchema,
  createMaintenanceSchema,
} = require('../validators/vehicle.schema');
const {
  listVehiclesCtrl,
  getVehicleCtrl,
  createVehicleCtrl,
  updateVehicleCtrl,
  softDeleteVehicleCtrl,
  getMaintenanceHistoryCtrl,
  addMaintenanceCtrl,
  getVehicleStatsCtrl,
} = require('../controllers/vehicle.controller');

const router = express.Router();

router.use(authenticate, authorizeRole('admin'));

router.get('/', validate(queryVehicleSchema, 'query'), listVehiclesCtrl);
router.post('/', validate(createVehicleSchema), createVehicleCtrl);
router.get('/:id', getVehicleCtrl);
router.patch('/:id', validate(updateVehicleSchema), updateVehicleCtrl);
router.delete('/:id', softDeleteVehicleCtrl);
router.get('/:id/maintenance', getMaintenanceHistoryCtrl);
router.post('/:id/maintenance', validate(createMaintenanceSchema), addMaintenanceCtrl);
router.get('/:id/stats', getVehicleStatsCtrl);

module.exports = router;
