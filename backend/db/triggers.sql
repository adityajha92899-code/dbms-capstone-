-- FleetFlow TMS — Triggers & Trigger Functions (Phase 1)

-- Sequence for sequential invoice numbers (INV-YYYYMM-XXXXX)
CREATE SEQUENCE IF NOT EXISTS seq_invoice_number START WITH 1 INCREMENT BY 1;

-- 1. fn_check_trip_overlap()
-- Prevents double-booking a vehicle or driver for overlapping scheduled time windows
CREATE OR REPLACE FUNCTION fn_check_trip_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_conflict_trip VARCHAR(40);
BEGIN
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- Check vehicle overlap
    SELECT trip_number INTO v_conflict_trip
    FROM trips
    WHERE vehicle_id = NEW.vehicle_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status <> 'cancelled'
      AND tstzrange(scheduled_start, scheduled_end, '[)') &&
          tstzrange(NEW.scheduled_start, NEW.scheduled_end, '[)')
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Vehicle % is already booked on overlapping trip % during [%, %)',
            NEW.vehicle_id, v_conflict_trip, NEW.scheduled_start, NEW.scheduled_end;
    END IF;

    -- Check driver overlap
    SELECT trip_number INTO v_conflict_trip
    FROM trips
    WHERE driver_id = NEW.driver_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status <> 'cancelled'
      AND tstzrange(scheduled_start, scheduled_end, '[)') &&
          tstzrange(NEW.scheduled_start, NEW.scheduled_end, '[)')
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Driver % is already assigned to overlapping trip % during [%, %)',
            NEW.driver_id, v_conflict_trip, NEW.scheduled_start, NEW.scheduled_end;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_trip_overlap ON trips;
CREATE TRIGGER trg_check_trip_overlap
    BEFORE INSERT OR UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_trip_overlap();

-- 2. fn_trip_status_timestamps()
-- Automatically records actual_start / actual_end on trip status transitions
CREATE OR REPLACE FUNCTION fn_trip_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'in_progress' AND NEW.actual_start IS NULL THEN
            NEW.actual_start := NOW();
        ELSIF NEW.status = 'completed' THEN
            IF NEW.actual_start IS NULL THEN
                NEW.actual_start := COALESCE(OLD.actual_start, NEW.scheduled_start);
            END IF;
            IF NEW.actual_end IS NULL THEN
                NEW.actual_end := NOW();
            END IF;
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trip_status_timestamps ON trips;
CREATE TRIGGER trg_trip_status_timestamps
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION fn_trip_status_timestamps();

-- 3. fn_vehicle_maintenance_flag()
-- Flags a vehicle as 'maintenance' when an active maintenance record is inserted
CREATE OR REPLACE FUNCTION fn_vehicle_maintenance_flag()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status <> 'completed' THEN
        UPDATE vehicles
        SET status = 'maintenance',
            updated_at = NOW()
        WHERE id = NEW.vehicle_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicle_maintenance_flag ON maintenance_records;
CREATE TRIGGER trg_vehicle_maintenance_flag
    AFTER INSERT ON maintenance_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_vehicle_maintenance_flag();

-- 4. fn_license_validity()
-- Blocks assigning a driver whose license expires before the scheduled trip start
CREATE OR REPLACE FUNCTION fn_license_validity()
RETURNS TRIGGER AS $$
DECLARE
    v_expiry DATE;
BEGIN
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    SELECT license_expiry INTO v_expiry
    FROM driver_profiles
    WHERE id = NEW.driver_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Driver profile % does not exist', NEW.driver_id;
    END IF;

    IF v_expiry < (NEW.scheduled_start AT TIME ZONE 'UTC')::date THEN
        RAISE EXCEPTION 'Driver % license expired on %, cannot schedule trip starting %',
            NEW.driver_id, v_expiry, NEW.scheduled_start;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_license_validity ON trips;
CREATE TRIGGER trg_license_validity
    BEFORE INSERT OR UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION fn_license_validity();

-- 5. fn_set_updated_at()
-- Updates updated_at timestamp on users row modification
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- 6. fn_booking_invoice_number()
-- Generates INV-YYYYMM-XXXXX when a booking transitions to 'delivered'
CREATE OR REPLACE FUNCTION fn_booking_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    v_inv VARCHAR(32);
BEGIN
    IF NEW.status = 'delivered'
       AND OLD.status IS DISTINCT FROM 'delivered'
       AND NEW.invoice_number IS NULL THEN
        v_inv := 'INV-' || to_char(NOW(), 'YYYYMM') || '-' ||
                 lpad(nextval('seq_invoice_number')::text, 5, '0');
        UPDATE bookings
        SET invoice_number = v_inv,
            delivered_at = COALESCE(delivered_at, NOW()),
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_invoice_number ON bookings;
CREATE TRIGGER trg_booking_invoice_number
    AFTER UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION fn_booking_invoice_number();
