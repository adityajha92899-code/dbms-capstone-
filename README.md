# FleetFlow TMS (Transport Management System)

**FleetFlow TMS** is a full-stack Transport Management System built with Node.js, Express, PostgreSQL 16, Socket.io, React 18, and Tailwind CSS—featuring role-based portals for Admins/Dispatchers, Drivers, and Customers, database-enforced scheduling integrity, and real-time GPS telemetry.

---

## Screenshots

- ![Admin Operations Dashboard](docs/screenshots/admin-dashboard.png "Admin Operations Dashboard with Live Map and KPIs")
- ![Dispatch Kanban Board](docs/screenshots/trips-kanban.png "Trips Kanban Board and 3-Step Schedule Wizard")
- ![Customer Booking Wizard](docs/screenshots/customer-booking.png "Customer 3-Step Transport Request Wizard")

---

## Architecture Diagram

```text
+-------------------+       HTTPS / WS        +------------------------+       pg.Pool        +----------------------+
|  React 18 + Vite  | <---------------------> |  Express + Socket.io   | <------------------> |   PostgreSQL 16      |
|  Tailwind / Map   |   JWT + HttpOnly Cookie |  Zod + Helmet + Cron   |   Triggers & Views   |   14 Tables / 3NF    |
+-------------------+                         +------------------------+                      +----------------------+
```

> Source diagram: `docs/architecture.drawio` (create/export via [app.diagrams.net](https://app.diagrams.net)).

---

## ER Diagram & Database Schema (14 Tables)

Full DBML source: [`docs/er-diagram.dbml`](docs/er-diagram.dbml) (paste into [dbdiagram.io](https://dbdiagram.io) to export `docs/ERD.png`).

1. `users` — Core identity, role (`admin`, `dispatcher`, `driver`, `customer`), lockout counters, `settings` JSONB.
2. `driver_profiles` — 1:1 with `users`; license number, class, expiry, rating, availability status.
3. `customer_profiles` — 1:1 with `users`; company name, tax ID, billing address, credit limit.
4. `vehicles` — Fleet registry (`reg_number`, `vin`, `vehicle_type`, `capacity_kg`, `insurance_expiry`, `fitness_expiry`).
5. `routes` — Freight corridors (`code`, `origin`, `destination`, `distance_km`, `base_rate_per_km`).
6. `trips` — Scheduled dispatches linking `vehicles`, `driver_profiles`, `routes`, and `users` (dispatcher), plus live `current_lat`/`current_lng`.
7. `bookings` — Customer shipment requests linked to `customer_profiles` and optionally `trips`, with `invoice_number`.
8. `tracking_events` — Time-series GPS pings, departures, arrivals, and status events per `trip_id`.
9. `maintenance_records` — Service logs per `vehicle_id`.
10. `fuel_logs` — Fueling events per `vehicle_id`, `driver_id`, and `trip_id`.
11. `refresh_tokens` — SHA-256 hashed refresh tokens with revocation timestamps.
12. `login_audit_log` — Immutable authentication & admin status-change audit trail.
13. `password_reset_tokens` — Hashed single-use password reset tokens.
14. `notifications` — Persistent user alerts (`notif_id`, `user_id`, `type`, `message`, `read`).

---

## Normalization Justification (3NF / BCNF)

- **1NF:** Every column holds atomic values; no repeating groups (e.g., `tracking_events` and `bookings` are normalized into separate tables rather than arrays).
- **2NF:** All tables use single-column UUID primary keys (`gen_random_uuid()`), eliminating partial dependencies.
- **3NF / BCNF:** Transitive dependencies are removed—driver-specific attributes live in `driver_profiles`, customer billing attributes live in `customer_profiles`, and route distances/rates live in `routes` rather than being duplicated on `trips`.

---

## Features by Role

- **Admin / Dispatcher:** Live KPI dashboard, interactive Leaflet fleet map, 3-step trip scheduling, Kanban drag-and-drop dispatch, fleet/driver/route CRUD, maintenance logging, 5-tab reports + CSV export, user management, and login audit log.
- **Driver:** Today's assigned trips, one-click Start/Complete status transitions, live route map, and GPS telemetry pings.
- **Customer:** 3-step booking wizard with live quote estimation, active shipment tracking modal/timeline, and printable/downloadable invoices.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 18, Vite, Tailwind CSS, Zustand, TanStack Query, Recharts, React Leaflet, Radix UI |
| Backend | Node.js 20, Express, Socket.io, Zod, Helmet, `express-rate-limit`, `node-cron`, Swagger UI |
| Database | PostgreSQL 16 (`pg` pool, PL/pgSQL triggers, views, partial/composite indexes) |
| Testing & CI | Jest, Supertest, Vitest, React Testing Library, Playwright, GitHub Actions |
| Deployment | Docker, Multi-stage Dockerfiles, Nginx, Docker Compose |

---

## Setup

### Development

```bash
git clone <repository-url>
cd fleetflow

# Start PostgreSQL (auto-runs schema, triggers, views, indexes, and seed data)
docker compose up -d db

# Backend
cd backend && cp .env.example .env && npm install && npm run dev

# Frontend (new terminal)
cd ../frontend && cp .env.example .env && npm install && npm run dev
```

### Production (Docker Compose)

```bash
docker compose -f docker-compose.yml up -d --build
```

---

## Login Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| Admin | `admin@tms.com` | `Admin@123` |
| Dispatcher | `dispatcher@tms.com` | `Dispatch@123` |
| Driver 1 | `driver1@tms.com` | `Driver@123` |
| Driver 2 | `driver2@tms.com` | `Driver@123` |
| Customer 1 | `customer1@tms.com` | `Customer@123` |
| Customer 2 | `customer2@tms.com` | `Customer@123` |

---

## API Documentation

- **Swagger UI:** `http://localhost:4000/api-docs`
- **Markdown Reference:** [`docs/api.md`](docs/api.md)
- **Postman Collection:** [`backend/postman.json`](backend/postman.json)

---

## Design Decisions

- **PostgreSQL:** Relational integrity, `tstzrange` overlap detection, triggers, and analytical CTEs/views.
- **bcrypt (cost 12):** Industry-standard adaptive password hashing resistant to brute-force attacks.
- **JWT + HttpOnly Refresh Rotation:** Short-lived 15m access tokens paired with rotated 7d HttpOnly refresh tokens and reuse detection.
- **TanStack Query:** Declarative caching, background polling, and optimistic UI updates.
- **Zustand:** Minimal, boilerplate-free client auth state with `localStorage` persistence.

---

## Database Triggers, Views & Indexes

### Triggers (`backend/db/triggers.sql`)
1. `fn_check_trip_overlap()` — Prevents double-booking a vehicle or driver using `tstzrange &&`.
2. `fn_trip_status_timestamps()` — Auto-populates `actual_start` and `actual_end` on status changes.
3. `fn_vehicle_maintenance_flag()` — Sets `vehicles.status = 'maintenance'` on active maintenance insert.
4. `fn_license_validity()` — Blocks scheduling a driver whose license expires before `scheduled_start`.
5. `fn_set_updated_at()` — Maintains `users.updated_at` on updates.
6. `fn_booking_invoice_number()` — Generates sequential `INV-YYYYMM-XXXXX` when a booking is delivered.

### Views (`backend/db/views.sql`)
- `vw_vehicle_utilization` — Total trips, hours, avg distance, and last trip date per vehicle.
- `vw_driver_performance` — Total trips, on-time percentage, and average rating per driver.
- `vw_revenue_by_month` — Monthly revenue and trip count aggregation.
- `vw_active_trips` — Live snapshot of `scheduled` and `in_progress` trips.

### Indexes (`backend/db/indexes.sql`)
- `idx_users_email`, `idx_users_type`, `idx_trips_vehicle_time`, `idx_trips_driver_time`, `idx_trips_status`, `idx_bookings_customer`, `idx_bookings_status`, `idx_tracking_trip_time`, `idx_audit_user_time`.

---

## Security Checklist

1. Helmet HTTP security headers enabled
2. Strict CORS origin with `credentials: true`
3. `bcrypt` cost-12 password hashing
4. Short-lived JWT access tokens (15m) with issuer/audience verification
5. HttpOnly, `SameSite=Strict` refresh token cookies
6. Refresh token SHA-256 hashing in PostgreSQL
7. Refresh token rotation + reuse detection (revokes all user sessions)
8. Account lockout after 5 failed login attempts (15-minute cooldown)
9. Rate limiting on `/login` (5/15m) and `/register` (3/hr)
10. Zod request validation on body, query, and params
11. Parameterized SQL queries (`$1, $2...`) preventing SQL injection
12. Role-based access control (`authorizeRole`) + resource ownership checks
13. Immutable `login_audit_log` for all auth & admin status events
14. Non-root Docker runtime user (`appuser`)
15. Environment secrets excluded via `.gitignore`

---

## Testing Instructions

```bash
# Backend Jest + Supertest suite
cd backend && npm test

# Frontend Vitest + React Testing Library suite
cd frontend && npm test
```

---

## Pre-Submission Verification

- [ ] `docker compose up -d` starts everything
- [ ] All 6 demo logins work
- [ ] Admin dashboard shows KPIs
- [ ] Creating overlapping trip returns 409
- [ ] Driver sees only own trips
- [ ] Customer sees only own bookings
- [ ] Live map updates via socket
- [ ] CSV export downloads
- [ ] Password reset works
- [ ] Audit log shows login attempts
- [ ] Test suite passes (backend + frontend)
- [ ] README complete

---

## Known Limitations & Future Work

- Route map polylines currently use corridor anchor coordinates; integrating a geocoding/routing API (e.g., OSRM or Mapbox) will render turn-by-turn road geometry.
- Automated email delivery for password resets and maintenance alerts can be connected via SMTP/SendGrid in a future phase.

## Credits & License

Built as the **FleetFlow TMS** capstone project. Licensed under the MIT License.
