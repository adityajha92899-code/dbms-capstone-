-- FleetFlow TMS — Reporting & Operational Views (Phase 1)

-- 1. vw_vehicle_utilization
CREATE OR REPLACE VIEW vw_vehicle_utilization AS
SELECT
    v.id AS vehicle_id,
    v.reg_number,
    COUNT(t.id) FILTER (WHERE t.status <> 'cancelled') AS total_trips,
    ROUND(
        COALESCE(
            SUM(
                EXTRACT(EPOCH FROM (
                    COALESCE(t.actual_end, t.scheduled_end) -
                    COALESCE(t.actual_start, t.scheduled_start)
                )) / 3600.0
            ) FILTER (WHERE t.status = 'completed'),
            0
        )::numeric,
        2
    ) AS total_hours,
    ROUND(
        COALESCE(
            AVG(r.distance_km) FILTER (WHERE t.status <> 'cancelled'),
            0
        )::numeric,
        2
    ) AS avg_distance_km,
    MAX(COALESCE(t.actual_end, t.scheduled_start)) FILTER (WHERE t.status <> 'cancelled') AS last_trip_date
FROM vehicles v
LEFT JOIN trips t ON t.vehicle_id = v.id
LEFT JOIN routes r ON r.id = t.route_id
GROUP BY v.id, v.reg_number;

-- 2. vw_driver_performance
CREATE OR REPLACE VIEW vw_driver_performance AS
SELECT
    dp.id AS driver_id,
    u.full_name AS name,
    dp.license_class,
    COUNT(t.id) FILTER (WHERE t.status <> 'cancelled') AS total_trips,
    ROUND(
        COALESCE(
            100.0 * COUNT(t.id) FILTER (
                WHERE t.status = 'completed'
                  AND t.actual_end IS NOT NULL
                  AND t.actual_end <= t.scheduled_end
            ) / NULLIF(COUNT(t.id) FILTER (WHERE t.status = 'completed'), 0),
            100.0
        )::numeric,
        2
    ) AS on_time_pct,
    dp.rating AS avg_rating
FROM driver_profiles dp
JOIN users u ON u.id = dp.user_id
LEFT JOIN trips t ON t.driver_id = dp.id
GROUP BY dp.id, u.full_name, dp.license_class, dp.rating;

-- 3. vw_revenue_by_month
CREATE OR REPLACE VIEW vw_revenue_by_month AS
SELECT
    to_char(date_trunc('month', COALESCE(b.delivered_at, b.created_at)), 'YYYY-MM') AS month,
    ROUND(COALESCE(SUM(b.quoted_price), 0)::numeric, 2) AS revenue,
    COUNT(DISTINCT b.trip_id) AS trip_count
FROM bookings b
WHERE b.status <> 'cancelled'
GROUP BY date_trunc('month', COALESCE(b.delivered_at, b.created_at))
ORDER BY month DESC;

-- 4. vw_active_trips
CREATE OR REPLACE VIEW vw_active_trips AS
SELECT
    t.id AS trip_id,
    v.reg_number AS vehicle_reg,
    u.full_name AS driver_name,
    r.origin,
    r.destination,
    t.status,
    t.scheduled_start,
    (
        SELECT MAX(te.occurred_at)
        FROM tracking_events te
        WHERE te.trip_id = t.id
    ) AS last_location_update
FROM trips t
JOIN vehicles v ON v.id = t.vehicle_id
JOIN driver_profiles dp ON dp.id = t.driver_id
JOIN users u ON u.id = dp.user_id
JOIN routes r ON r.id = t.route_id
WHERE t.status IN ('scheduled', 'in_progress');
