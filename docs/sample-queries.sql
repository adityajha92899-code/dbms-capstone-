-- FleetFlow TMS — 10 Sample Analytical & Operational SQL Queries

-- 1. Multi-table JOIN: Active trips with vehicle, driver, and route details
SELECT t.trip_number, v.reg_number, u.full_name AS driver, r.origin, r.destination, t.status
FROM trips t
JOIN vehicles v ON v.id = t.vehicle_id
JOIN driver_profiles dp ON dp.id = t.driver_id
JOIN users u ON u.id = dp.user_id
JOIN routes r ON r.id = t.route_id
WHERE t.status IN ('scheduled', 'in_progress');

-- 2. Aggregation: Monthly revenue from delivered bookings
SELECT to_char(date_trunc('month', delivered_at), 'YYYY-MM') AS month,
       COUNT(*) AS delivered_count,
       SUM(quoted_price) AS total_revenue
FROM bookings
WHERE status = 'delivered'
GROUP BY 1
ORDER BY 1 DESC;

-- 3. Window Function: Rank drivers by completed trips and rating
SELECT dp.id, u.full_name,
       COUNT(t.id) AS completed_trips,
       RANK() OVER (ORDER BY COUNT(t.id) DESC, dp.rating DESC) AS driver_rank
FROM driver_profiles dp
JOIN users u ON u.id = dp.user_id
LEFT JOIN trips t ON t.driver_id = dp.id AND t.status = 'completed'
GROUP BY dp.id, u.full_name, dp.rating;

-- 4. CTE: 30-day KPI summary
WITH trip_30d AS (
  SELECT COUNT(*) AS total,
         COUNT(*) FILTER (WHERE actual_end <= scheduled_end) AS on_time
  FROM trips
  WHERE status = 'completed' AND actual_end >= NOW() - INTERVAL '30 days'
)
SELECT total, on_time, ROUND(100.0 * on_time / NULLIF(total, 0), 2) AS on_time_pct
FROM trip_30d;

-- 5. Running Total Window Function: Cumulative maintenance spend per vehicle
SELECT v.reg_number, m.service_date, m.cost,
       SUM(m.cost) OVER (PARTITION BY v.id ORDER BY m.service_date) AS cumulative_cost
FROM maintenance_records m
JOIN vehicles v ON v.id = m.vehicle_id;

-- 6. Subquery: Vehicles with upcoming insurance or service due in 7 days
SELECT reg_number, insurance_expiry
FROM vehicles
WHERE insurance_expiry <= CURRENT_DATE + INTERVAL '7 days';

-- 7. Fuel efficiency per vehicle (km/L)
SELECT v.reg_number,
       ROUND(SUM(r.distance_km) / NULLIF(SUM(fl.liters), 0), 2) AS km_per_liter
FROM fuel_logs fl
JOIN vehicles v ON v.id = fl.vehicle_id
JOIN trips t ON t.id = fl.trip_id
JOIN routes r ON r.id = t.route_id
GROUP BY v.reg_number
ORDER BY km_per_liter DESC;

-- 8. Failed login audit summary per email
SELECT email, COUNT(*) AS failed_count, MAX(occurred_at) AS last_attempt
FROM login_audit_log
WHERE success = FALSE
GROUP BY email
ORDER BY failed_count DESC;

-- 9. EXPLAIN ANALYZE: Indexed email lookup
EXPLAIN ANALYZE
SELECT id, email, user_type FROM users WHERE lower(email) = 'admin@tms.com';

-- 10. EXPLAIN ANALYZE: Indexed tracking timeline lookup
EXPLAIN ANALYZE
SELECT * FROM tracking_events
WHERE trip_id = (SELECT id FROM trips LIMIT 1)
ORDER BY occurred_at DESC;
