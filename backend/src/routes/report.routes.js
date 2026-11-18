const express = require('express');
const { authenticate, authorizeRole } = require('../middleware/auth');
const {
  getKpisCtrl,
  getFuelEfficiencyCtrl,
  getMaintenanceCostCtrl,
  getRevenueCtrl,
  getTripVolumeCtrl,
  getDriverLeaderboardCtrl,
  exportAllCsvCtrl,
} = require('../controllers/report.controller');

const router = express.Router();

router.use(authenticate, authorizeRole('admin'));

router.get('/kpis', getKpisCtrl);
router.get('/fuel-efficiency', getFuelEfficiencyCtrl);
router.get('/maintenance-cost', getMaintenanceCostCtrl);
router.get('/revenue', getRevenueCtrl);
router.get('/trip-volume', getTripVolumeCtrl);
router.get('/driver-leaderboard', getDriverLeaderboardCtrl);
router.get('/export', exportAllCsvCtrl);

module.exports = router;
