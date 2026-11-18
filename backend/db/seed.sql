-- FleetFlow TMS — Seed Data (Phase 1)
-- Generates loginable users with real bcrypt (cost 12) hashes + bulk operational data.

BEGIN;

-- 1. Core Loginable Users (6 accounts with verified cost-12 bcrypt hashes)
INSERT INTO users (email, password_hash, full_name, phone, user_type, is_active) VALUES
    ('admin@tms.com',      '$2b$12$UxugGTgljEzlxHTSMjkiHeb2VKHBhej4ZJlW6B5Ym9tEZwH/9u6Bq', 'Aarav Mehta',      '+1-555-0100', 'admin',      TRUE),
    ('dispatcher@tms.com', '$2b$12$iAQ4GZOwi8uCaIeRjS1CAOZy8dgOf3zittjMlXRhHCkokmZRm/LsK', 'Priya Sharma',     '+1-555-0101', 'dispatcher', TRUE),
    ('driver1@tms.com',    '$2b$12$Jk6CdBANPD0K1ITnrsUsZOsleq/9CGpGYDZAH3Eidvmk3k42SlvZK', 'Marcus Vance',     '+1-555-0201', 'driver',     TRUE),
    ('driver2@tms.com',    '$2b$12$MqT6q1emI4x894XJqVBoiefMNUxEUTvornieeb0mQ/LiS5r9VsK8G', 'Elena Rostova',    '+1-555-0202', 'driver',     TRUE),
    ('customer1@tms.com',  '$2b$12$tHmfGGrnhoHxmL9nDMY5zeemhu2DqdZRZHJVWF7kgrnVAwme6JO4u', 'Liam O''Connor',   '+1-555-0301', 'customer',   TRUE),
    ('customer2@tms.com',  '$2b$12$fIhWV7x9I1D3b3.hsMdkZu0B7a9yxsdCsktLsTBmQD0PvGUURW4s2', 'Sophia Chen',      '+1-555-0302', 'customer',   TRUE);

-- Additional 8 driver users (driver3..driver10) for 10 total drivers
INSERT INTO users (email, password_hash, full_name, phone, user_type, is_active)
SELECT
    'driver' || g || '@tms.com',
    '$2b$12$Jk6CdBANPD0K1ITnrsUsZOsleq/9CGpGYDZAH3Eidvmk3k42SlvZK',
    'Driver ' || (ARRAY['Carlos Mendez','Nadia Patel','Devon Brooks','Kieran Walsh','Tariq Al-Mansoor','Hannah Kim','Lucas Silva','Maya Lin'])[g - 2],
    '+1-555-02' || lpad(g::text, 2, '0'),
    'driver',
    TRUE
FROM generate_series(3, 10) AS g;

-- Additional 3 customer users (customer3..customer5) for 5 total customers
INSERT INTO users (email, password_hash, full_name, phone, user_type, is_active)
SELECT
    'customer' || g || '@tms.com',
    '$2b$12$tHmfGGrnhoHxmL9nDMY5zeemhu2DqdZRZHJVWF7kgrnVAwme6JO4u',
    (ARRAY['Vikram Rao','Claire Dubois','Noah Bennett'])[g - 2],
    '+1-555-03' || lpad(g::text, 2, '0'),
    'customer',
    TRUE
FROM generate_series(3, 5) AS g;

-- 2. Driver Profiles (10 drivers)
INSERT INTO driver_profiles (user_id, license_number, license_class, license_expiry, hire_date, rating, status)
SELECT
    u.id,
    'DL-FF-' || lpad(row_number() OVER (ORDER BY u.email)::text, 5, '0'),
    (ARRAY['CDL-A','CDL-A','CDL-B','CDL-A','CDL-C','CDL-A','CDL-B','CDL-A','CDL-A','CDL-B'])[row_number() OVER (ORDER BY u.email)],
    DATE '2029-06-30' + ((row_number() OVER (ORDER BY u.email) * 30)::integer),
    DATE '2022-01-15' + ((row_number() OVER (ORDER BY u.email) * 45)::integer),
    ROUND((4.20 + (row_number() OVER (ORDER BY u.email) % 8) * 0.10)::numeric, 2),
    CASE WHEN row_number() OVER (ORDER BY u.email) <= 7 THEN 'available' ELSE 'on_trip' END
FROM users u
WHERE u.user_type = 'driver'
ORDER BY u.email;

-- 3. Customer Profiles (5 customers)
INSERT INTO customer_profiles (user_id, company_name, tax_id, billing_address, credit_limit, payment_terms_days)
SELECT
    u.id,
    (ARRAY[
        'Apex Retail Logistics Ltd.',
        'NovaTech Electronics Corp.',
        'GreenHarvest Foods Inc.',
        'Summit Industrial Supply',
        'Pacific Pharma Distributors'
    ])[row_number() OVER (ORDER BY u.email)],
    'TAX-' || (100000 + row_number() OVER (ORDER BY u.email) * 1111),
    (100 + row_number() OVER (ORDER BY u.email) * 50) || ' Commerce Blvd, Suite ' || (row_number() OVER (ORDER BY u.email) * 100) || ', Chicago, IL',
    50000.00 + row_number() OVER (ORDER BY u.email) * 25000.00,
    30
FROM users u
WHERE u.user_type = 'customer'
ORDER BY u.email;

-- 4. Vehicles (20 vehicles)
INSERT INTO vehicles (reg_number, vin, make, model, year, vehicle_type, capacity_kg, volume_cbm, fuel_type, odometer_km, status, insurance_expiry)
SELECT
    'FF-' || (1000 + g) || '-TX',
    '1FTFW1ET' || lpad(g::text, 9, '0'),
    (ARRAY['Freightliner','Volvo','Kenworth','Peterbilt','Isuzu'])[((g - 1) % 5) + 1],
    (ARRAY['Cascadia','VNL 760','T680','579','NPR-HD'])[((g - 1) % 5) + 1],
    2019 + (g % 6),
    (ARRAY['semi_truck','semi_truck','box_truck','reefer','flatbed'])[((g - 1) % 5) + 1],
    (ARRAY[22000, 20000, 8500, 18000, 15000])[((g - 1) % 5) + 1],
    (ARRAY[85.0, 80.0, 42.0, 72.0, 60.0])[((g - 1) % 5) + 1],
    CASE WHEN g % 7 = 0 THEN 'hybrid' ELSE 'diesel' END,
    25000.0 + (g * 4320.5),
    'available',
    DATE '2027-12-31' + (g * 10)
FROM generate_series(1, 20) AS g;

-- 5. Routes (8 routes)
INSERT INTO routes (code, name, origin, destination, distance_km, estimated_duration_hrs, base_rate_per_km, is_active) VALUES
    ('RT-001', 'Midwest Express',      'Chicago, IL',       'Detroit, MI',      455.00,  5.50, 2.40, TRUE),
    ('RT-002', 'Texas Triangle North', 'Dallas, TX',        'Houston, TX',      385.00,  4.50, 2.30, TRUE),
    ('RT-003', 'Pacific Coast Run',    'Los Angeles, CA',   'San Francisco, CA',615.00,  7.50, 2.80, TRUE),
    ('RT-004', 'Northeast Corridor',   'Newark, NJ',        'Boston, MA',       365.00,  4.75, 2.95, TRUE),
    ('RT-005', 'Southeast Freight',    'Atlanta, GA',       'Charlotte, NC',    395.00,  4.50, 2.25, TRUE),
    ('RT-006', 'Mountain Haul',        'Denver, CO',        'Salt Lake City, UT',840.00, 10.00, 2.65, TRUE),
    ('RT-007', 'Great Lakes Link',     'Minneapolis, MN',   'Chicago, IL',      655.00,  7.25, 2.45, TRUE),
    ('RT-008', 'Sunbelt Connector',    'Phoenix, AZ',       'Los Angeles, CA',  600.00,  6.75, 2.55, TRUE);

-- 6. Trips (60 trips, spaced 2 days apart so no vehicle/driver overlaps occur)
WITH numbered_vehicles AS (
    SELECT id, row_number() OVER (ORDER BY reg_number) AS rn FROM vehicles
),
numbered_drivers AS (
    SELECT id, row_number() OVER (ORDER BY license_number) AS rn FROM driver_profiles
),
numbered_routes AS (
    SELECT id, row_number() OVER (ORDER BY code) AS rn FROM routes
),
dispatcher_user AS (
    SELECT id FROM users WHERE email = 'dispatcher@tms.com' LIMIT 1
)
INSERT INTO trips (
    trip_number, vehicle_id, driver_id, route_id, dispatcher_id,
    status, scheduled_start, scheduled_end, actual_start, actual_end, notes
)
SELECT
    'TRP-2026-' || lpad(g::text, 4, '0'),
    nv.id,
    nd.id,
    nr.id,
    du.id,
    CASE
        WHEN g <= 45 THEN 'completed'
        WHEN g <= 52 THEN 'in_progress'
        WHEN g <= 58 THEN 'scheduled'
        ELSE 'cancelled'
    END,
    NOW() - INTERVAL '104 days' + (g * INTERVAL '2 days'),
    NOW() - INTERVAL '104 days' + (g * INTERVAL '2 days') + INTERVAL '8 hours',
    CASE
        WHEN g <= 45 THEN NOW() - INTERVAL '104 days' + (g * INTERVAL '2 days') + INTERVAL '5 minutes'
        WHEN g <= 52 THEN NOW() - INTERVAL '104 days' + (g * INTERVAL '2 days')
        ELSE NULL
    END,
    CASE
        WHEN g <= 45 THEN NOW() - INTERVAL '104 days' + (g * INTERVAL '2 days') + INTERVAL '7 hours'
        ELSE NULL
    END,
    'Seeded operational trip #' || g
FROM generate_series(1, 60) AS g
JOIN numbered_vehicles nv ON nv.rn = ((g - 1) % 20) + 1
JOIN numbered_drivers  nd ON nd.rn = ((g - 1) % 10) + 1
JOIN numbered_routes   nr ON nr.rn = ((g - 1) % 8) + 1
CROSS JOIN dispatcher_user du;

-- 7. Bookings (40 bookings)
WITH numbered_customers AS (
    SELECT id, row_number() OVER (ORDER BY company_name) AS rn FROM customer_profiles
),
numbered_trips AS (
    SELECT t.id, r.origin, r.destination, r.distance_km, r.base_rate_per_km,
           t.scheduled_start, t.actual_end,
           row_number() OVER (ORDER BY t.trip_number) AS rn
    FROM trips t
    JOIN routes r ON r.id = t.route_id
)
INSERT INTO bookings (
    booking_reference, customer_id, trip_id, origin, destination,
    cargo_description, weight_kg, volume_cbm, quoted_price,
    status, invoice_number, pickup_window_start, pickup_window_end, delivered_at, created_at
)
SELECT
    'BK-2026-' || lpad(g::text, 4, '0'),
    nc.id,
    nt.id,
    nt.origin,
    nt.destination,
    (ARRAY['Palletized Consumer Goods','Industrial Machinery Parts','Temperature-Controlled Produce','Retail Electronics','Medical Supplies'])[((g - 1) % 5) + 1],
    1200.00 + (g * 125.50),
    12.50 + (g % 25),
    ROUND((nt.distance_km * nt.base_rate_per_km * 1.15 + (g * 25))::numeric, 2),
    CASE
        WHEN g <= 25 THEN 'delivered'
        WHEN g <= 32 THEN 'in_transit'
        WHEN g <= 36 THEN 'confirmed'
        ELSE 'pending'
    END,
    CASE
        WHEN g <= 25 THEN 'INV-202610-' || lpad(nextval('seq_invoice_number')::text, 5, '0')
        ELSE NULL
    END,
    nt.scheduled_start - INTERVAL '2 hours',
    nt.scheduled_start,
    CASE WHEN g <= 25 THEN COALESCE(nt.actual_end, nt.scheduled_start + INTERVAL '7 hours') ELSE NULL END,
    nt.scheduled_start - INTERVAL '3 days'
FROM generate_series(1, 40) AS g
JOIN numbered_customers nc ON nc.rn = ((g - 1) % 5) + 1
JOIN numbered_trips nt ON nt.rn = g;

-- 8. Tracking Events (200 events across trips 1..52)
WITH numbered_trips AS (
    SELECT id, scheduled_start, row_number() OVER (ORDER BY trip_number) AS rn
    FROM trips
    WHERE status <> 'cancelled'
)
INSERT INTO tracking_events (trip_id, event_type, latitude, longitude, speed_kmh, location_name, notes, occurred_at)
SELECT
    nt.id,
    (ARRAY['departure','gps_ping','checkpoint','gps_ping','arrival'])[((g - 1) % 5) + 1],
    ROUND((34.0500 + ((g % 15) * 0.45))::numeric, 6),
    ROUND((-118.2400 + ((g % 20) * 1.65))::numeric, 6),
    CASE WHEN (g % 5) = 0 THEN 0.00 ELSE 75.00 + (g % 25) END,
    'Milepost ' || (10 + (g * 7) % 450) || ' Corridor',
    'Automated telemetry event #' || g,
    nt.scheduled_start + (((g % 5) + 1) * INTERVAL '45 minutes')
FROM generate_series(1, 200) AS g
JOIN numbered_trips nt ON nt.rn = ((g - 1) % 52) + 1;

-- 9. Maintenance Records (15 records: 12 completed, 3 in_progress which trigger vehicle maintenance flag)
WITH numbered_vehicles AS (
    SELECT id, odometer_km, row_number() OVER (ORDER BY reg_number) AS rn FROM vehicles
)
INSERT INTO maintenance_records (
    vehicle_id, maintenance_type, description, cost, odometer_at_service,
    service_date, next_service_date, performed_by, status
)
SELECT
    nv.id,
    (ARRAY['routine','repair','inspection','tire','emergency'])[((g - 1) % 5) + 1],
    'Scheduled fleet service #' || g || ' — brake, oil, and drivetrain check',
    350.00 + (g * 85.00),
    nv.odometer_km - 500.0,
    CURRENT_DATE - (30 - g),
    CURRENT_DATE + 90,
    'FleetFlow Certified Service Center',
    CASE WHEN g <= 12 THEN 'completed' ELSE 'in_progress' END
FROM generate_series(1, 15) AS g
JOIN numbered_vehicles nv ON nv.rn = ((g - 1) % 15) + 1;

-- 10. Fuel Logs (100 logs)
WITH numbered_vehicles AS (
    SELECT id, odometer_km, row_number() OVER (ORDER BY reg_number) AS rn FROM vehicles
),
numbered_drivers AS (
    SELECT id, row_number() OVER (ORDER BY license_number) AS rn FROM driver_profiles
),
numbered_trips AS (
    SELECT id, scheduled_start, row_number() OVER (ORDER BY trip_number) AS rn FROM trips
)
INSERT INTO fuel_logs (
    vehicle_id, driver_id, trip_id, liters, cost_per_liter, total_cost,
    odometer_km, station_name, fueled_at
)
SELECT
    nv.id,
    nd.id,
    nt.id,
    ROUND((120.0 + (g % 180))::numeric, 2),
    ROUND((1.350 + ((g % 10) * 0.025))::numeric, 3),
    ROUND(((120.0 + (g % 180)) * (1.350 + ((g % 10) * 0.025)))::numeric, 2),
    nv.odometer_km - ((100 - g) * 15),
    (ARRAY['Pilot Travel Center','Love''s Truck Stop','TA Petro','Shell Fleet Hub'])[((g - 1) % 4) + 1],
    nt.scheduled_start + INTERVAL '2 hours'
FROM generate_series(1, 100) AS g
JOIN numbered_vehicles nv ON nv.rn = ((g - 1) % 20) + 1
JOIN numbered_drivers  nd ON nd.rn = ((g - 1) % 10) + 1
JOIN numbered_trips    nt ON nt.rn = ((g - 1) % 50) + 1;

-- 11. Login Audit Log (30 entries)
WITH numbered_users AS (
    SELECT id, email, row_number() OVER (ORDER BY email) AS rn FROM users
)
INSERT INTO login_audit_log (user_id, email, success, failure_reason, ip_address, user_agent, occurred_at)
SELECT
    nu.id,
    nu.email,
    CASE WHEN g % 6 = 0 THEN FALSE ELSE TRUE END,
    CASE WHEN g % 6 = 0 THEN 'Invalid credentials' ELSE NULL END,
    ('192.168.1.' || (10 + (g % 40)))::inet,
    'Mozilla/5.0 FleetFlowClient/1.0',
    NOW() - (g * INTERVAL '6 hours')
FROM generate_series(1, 30) AS g
JOIN numbered_users nu ON nu.rn = ((g - 1) % 6) + 1;

COMMIT;
