const express = require('express');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  queryRouteSchema,
  createRouteSchema,
  updateRouteSchema,
} = require('../validators/route.schema');
const {
  listRoutesCtrl,
  getRouteCtrl,
  createRouteCtrl,
  updateRouteCtrl,
  softDeleteRouteCtrl,
  getRouteStatsCtrl,
} = require('../controllers/route.controller');

const router = express.Router();

router.use(authenticate, authorizeRole('admin'));

router.get('/', validate(queryRouteSchema, 'query'), listRoutesCtrl);
router.post('/', validate(createRouteSchema), createRouteCtrl);
router.get('/:id', getRouteCtrl);
router.patch('/:id', validate(updateRouteSchema), updateRouteCtrl);
router.delete('/:id', softDeleteRouteCtrl);
router.get('/:id/stats', getRouteStatsCtrl);

module.exports = router;
