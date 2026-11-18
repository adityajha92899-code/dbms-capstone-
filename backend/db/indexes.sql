-- FleetFlow TMS — Performance Indexes (Phase 1)

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (lower(email));

CREATE INDEX IF NOT EXISTS idx_users_type
    ON users (user_type)
    WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_time
    ON trips (vehicle_id, scheduled_start);

CREATE INDEX IF NOT EXISTS idx_trips_driver_time
    ON trips (driver_id, scheduled_start);

CREATE INDEX IF NOT EXISTS idx_trips_status
    ON trips (status);

CREATE INDEX IF NOT EXISTS idx_bookings_customer
    ON bookings (customer_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status
    ON bookings (status);

CREATE INDEX IF NOT EXISTS idx_tracking_trip_time
    ON tracking_events (trip_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user_time
    ON login_audit_log (user_id, occurred_at DESC);
