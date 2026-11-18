const cron = require('node-cron');
const { query } = require('../db');
const { emitToRoom } = require('../socket');

/**
 * Scan for vehicles with expiring insurance/fitness or maintenance due within 7 days,
 * persist notifications for all active admins, and emit alert:maintenance via Socket.io.
 */
async function runMaintenanceCheck() {
  const dueRes = await query(
    `SELECT DISTINCT v.id, v.reg_number, v.insurance_expiry, v.fitness_expiry,
            MAX(mr.next_service_date) AS next_service_due
     FROM vehicles v
     LEFT JOIN maintenance_records mr ON mr.vehicle_id = v.id
     WHERE v.status <> 'inactive'
       AND (
         v.insurance_expiry <= CURRENT_DATE + INTERVAL '7 days'
         OR (v.fitness_expiry IS NOT NULL AND v.fitness_expiry <= CURRENT_DATE + INTERVAL '7 days')
         OR mr.next_service_date <= CURRENT_DATE + INTERVAL '7 days'
       )
     GROUP BY v.id, v.reg_number, v.insurance_expiry, v.fitness_expiry`
  );

  if (dueRes.rows.length === 0) {
    return [];
  }

  const adminsRes = await query(
    `SELECT id FROM users WHERE user_type = 'admin' AND is_active = TRUE`
  );

  const alerts = [];
  for (const vehicle of dueRes.rows) {
    const message = `Vehicle ${vehicle.reg_number} has compliance/maintenance due within 7 days (insurance: ${vehicle.insurance_expiry}, next service: ${vehicle.next_service_due || 'N/A'})`;
    alerts.push({ vehicleId: vehicle.id, regNumber: vehicle.reg_number, message });

    for (const admin of adminsRes.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'maintenance_due', $2)`,
        [admin.id, message]
      );
    }

    emitToRoom('admin', 'alert:maintenance', {
      vehicle_id: vehicle.id,
      reg_number: vehicle.reg_number,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  return alerts;
}

/**
 * Schedule the maintenance compliance cron job every 6 hours.
 */
function startMaintenanceCron() {
  const task = cron.schedule('0 */6 * * *', async () => {
    try {
      await runMaintenanceCheck();
    } catch (err) {
      console.error('[Maintenance Cron Error]', err.message);
    }
  });
  return task;
}

module.exports = {
  runMaintenanceCheck,
  startMaintenanceCron,
};
