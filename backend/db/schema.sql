-- FleetFlow TMS — Complete PostgreSQL Schema (Phase 1 + Phase 2 Auth Columns)
-- Requires PostgreSQL 14+ (gen_random_uuid() built-in; pgcrypto enabled for safety)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. users
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    TEXT NOT NULL,
    full_name        VARCHAR(150) NOT NULL,
    phone            VARCHAR(30),
    user_type        VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'dispatcher', 'driver', 'customer')),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts  INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until     TIMESTAMPTZ,
    last_login_at    TIMESTAMPTZ,
    settings         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. driver_profiles
CREATE TABLE driver_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    license_number  VARCHAR(50) NOT NULL UNIQUE,
    license_class   VARCHAR(20) NOT NULL CHECK (license_class IN ('CDL-A', 'CDL-B', 'CDL-C', 'LMV')),
    license_expiry  DATE NOT NULL,
    hire_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    rating          NUMERIC(3, 2) NOT NULL DEFAULT 5.00 CHECK (rating >= 0.00 AND rating <= 5.00),
    status          VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on_trip', 'off_duty', 'suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. customer_profiles
CREATE TABLE customer_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_name        VARCHAR(200) NOT NULL,
    tax_id              VARCHAR(50),
    billing_address     TEXT NOT NULL,
    credit_limit        NUMERIC(12, 2) NOT NULL DEFAULT 50000.00 CHECK (credit_limit >= 0),
    payment_terms_days  INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. vehicles
CREATE TABLE vehicles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reg_number        VARCHAR(30) NOT NULL UNIQUE,
    vin               VARCHAR(32) NOT NULL UNIQUE,
    make              VARCHAR(80) NOT NULL,
    model             VARCHAR(80) NOT NULL,
    year              INTEGER NOT NULL CHECK (year >= 1990 AND year <= 2100),
    vehicle_type      VARCHAR(30) NOT NULL CHECK (vehicle_type IN ('semi_truck', 'box_truck', 'van', 'flatbed', 'reefer')),
    capacity_kg       NUMERIC(10, 2) NOT NULL CHECK (capacity_kg > 0),
    volume_cbm        NUMERIC(10, 2) CHECK (volume_cbm IS NULL OR volume_cbm > 0),
    fuel_type         VARCHAR(20) NOT NULL DEFAULT 'diesel' CHECK (fuel_type IN ('diesel', 'petrol', 'electric', 'hybrid')),
    odometer_km       NUMERIC(12, 1) NOT NULL DEFAULT 0.0 CHECK (odometer_km >= 0),
    status            VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_transit', 'maintenance', 'retired', 'inactive')),
    insurance_expiry  DATE NOT NULL,
    fitness_expiry    DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. routes
CREATE TABLE routes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    VARCHAR(30) NOT NULL UNIQUE,
    name                    VARCHAR(150) NOT NULL,
    origin                  VARCHAR(150) NOT NULL,
    destination             VARCHAR(150) NOT NULL,
    distance_km             NUMERIC(10, 2) NOT NULL CHECK (distance_km > 0),
    estimated_duration_hrs  NUMERIC(6, 2) NOT NULL CHECK (estimated_duration_hrs > 0),
    base_rate_per_km        NUMERIC(8, 2) NOT NULL DEFAULT 2.50 CHECK (base_rate_per_km >= 0),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. trips
CREATE TABLE trips (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_number      VARCHAR(40) NOT NULL UNIQUE,
    vehicle_id       UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id        UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE RESTRICT,
    route_id         UUID NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
    dispatcher_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    scheduled_start  TIMESTAMPTZ NOT NULL,
    scheduled_end    TIMESTAMPTZ NOT NULL,
    actual_start     TIMESTAMPTZ,
    actual_end           TIMESTAMPTZ,
    current_lat          NUMERIC(9, 6),
    current_lng          NUMERIC(9, 6),
    last_location_update TIMESTAMPTZ,
    notes                TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_trips_scheduled_window CHECK (scheduled_end > scheduled_start)
);

-- 7. bookings
CREATE TABLE bookings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference    VARCHAR(40) NOT NULL UNIQUE,
    customer_id          UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE RESTRICT,
    trip_id              UUID REFERENCES trips(id) ON DELETE SET NULL,
    origin               VARCHAR(150) NOT NULL,
    destination          VARCHAR(150) NOT NULL,
    cargo_description    TEXT NOT NULL,
    weight_kg            NUMERIC(10, 2) NOT NULL CHECK (weight_kg > 0),
    volume_cbm           NUMERIC(10, 2) CHECK (volume_cbm IS NULL OR volume_cbm > 0),
    quoted_price         NUMERIC(12, 2) NOT NULL CHECK (quoted_price >= 0),
    status               VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
    invoice_number       VARCHAR(32) UNIQUE,
    pickup_window_start  TIMESTAMPTZ,
    pickup_window_end    TIMESTAMPTZ,
    delivered_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. tracking_events
CREATE TABLE tracking_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    event_type     VARCHAR(25) NOT NULL CHECK (event_type IN ('departure', 'checkpoint', 'delay', 'arrival', 'gps_ping', 'incident', 'trip_created', 'location_ping', 'booking_confirmed', 'status_changed')),
    latitude       NUMERIC(9, 6) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude      NUMERIC(9, 6) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    speed_kmh      NUMERIC(6, 2) DEFAULT 0 CHECK (speed_kmh >= 0),
    location_name  VARCHAR(200),
    notes          TEXT,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. maintenance_records
CREATE TABLE maintenance_records (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id           UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    maintenance_type     VARCHAR(30) NOT NULL CHECK (maintenance_type IN ('routine', 'repair', 'inspection', 'tire', 'emergency')),
    description          TEXT NOT NULL,
    cost                 NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    odometer_at_service  NUMERIC(12, 1) CHECK (odometer_at_service IS NULL OR odometer_at_service >= 0),
    service_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    next_service_date    DATE,
    performed_by         VARCHAR(150),
    status               VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. fuel_logs
CREATE TABLE fuel_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id       UUID REFERENCES driver_profiles(id) ON DELETE SET NULL,
    trip_id         UUID REFERENCES trips(id) ON DELETE SET NULL,
    liters          NUMERIC(8, 2) NOT NULL CHECK (liters > 0),
    cost_per_liter  NUMERIC(6, 3) NOT NULL CHECK (cost_per_liter >= 0),
    total_cost      NUMERIC(10, 2) NOT NULL CHECK (total_cost >= 0),
    odometer_km     NUMERIC(12, 1) NOT NULL CHECK (odometer_km >= 0),
    station_name    VARCHAR(150),
    fueled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. refresh_tokens
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. login_audit_log
CREATE TABLE login_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    email           VARCHAR(255) NOT NULL,
    success         BOOLEAN NOT NULL,
    failure_reason  TEXT,
    ip_address      INET,
    user_agent      TEXT,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. password_reset_tokens
CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. notifications
CREATE TABLE notifications (
    notif_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    message     TEXT NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
