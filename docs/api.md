# FleetFlow TMS — REST API Reference

Base URL: `http://localhost:4000` (Swagger UI available at `/api-docs`)

## Authentication (`/api/v1/auth`)

| Method | Endpoint | Auth | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/login` | Public | `{ "email": "admin@tms.com", "password": "Admin@123" }` | `200 { accessToken, user }` + `refreshToken` HttpOnly cookie |
| `POST` | `/refresh` | Cookie/Body | `{}` | `200 { accessToken }` |
| `POST` | `/logout` | Bearer | `{}` | `200 { message }` |
| `POST` | `/register` | Public | `{ email, password, full_name, phone, company_name }` | `201 { user }` |
| `GET` | `/me` | Bearer | — | `200 { user }` |
| `PATCH` | `/password` | Bearer | `{ currentPassword, newPassword }` | `200 { message }` |
| `PATCH` | `/profile` | Bearer | `{ full_name?, phone?, settings? }` | `200 { user }` |

## Fleet, Drivers, Routes

- `GET /api/v1/vehicles` (Admin) — Paginated list `{ data, pagination }`
- `POST /api/v1/vehicles` (Admin) — Create vehicle (`409` on duplicate reg/VIN)
- `GET/PATCH/DELETE /api/v1/vehicles/:id` (Admin) — Detail, update, soft-delete (`status='inactive'`)
- `GET/POST /api/v1/vehicles/:id/maintenance` (Admin) — Maintenance history & insert (trigger sets vehicle status)
- `GET /api/v1/drivers`, `POST /api/v1/drivers`, `PATCH /api/v1/drivers/:id/status`, `GET /api/v1/drivers/:id/performance`
- `GET/POST /api/v1/routes`, `GET/PATCH/DELETE /api/v1/routes/:id`, `GET /api/v1/routes/:id/stats`

## Trips & Bookings

- `GET /api/v1/trips` (Role-scoped) — Admin sees all; Driver sees own; Customer sees `[]`
- `POST /api/v1/trips` (Admin) — `{ vehicle_id, driver_id, route_id, scheduled_start, scheduled_end, booking_ids? }` (`409` on overlap or expired license)
- `PATCH /api/v1/trips/:id/status` (Admin/Driver) — `{ status: "in_progress" | "completed" | "cancelled" }`
- `POST /api/v1/trips/:id/location` (Driver) — `{ lat, lng }` (emits Socket.io `location:update`)
- `GET /api/v1/bookings`, `POST /api/v1/bookings` (Customer), `PATCH /api/v1/bookings/:id/assign` (Admin), `PATCH /api/v1/bookings/:id/status`, `POST /api/v1/bookings/:id/invoice`

## Reports, Admin, Search & Notifications

- `GET /api/v1/reports/kpis|fuel-efficiency|maintenance-cost|revenue|trip-volume|driver-leaderboard|export` (Admin)
- `GET /api/v1/users`, `PATCH /api/v1/users/:id/status`, `POST /api/v1/users/:id/reset-password`, `GET /api/v1/audit/login` (Admin)
- `GET /api/v1/search?q=...` (Bearer) — Grouped `{ trips, vehicles, drivers, bookings }`
- `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all`
- `GET /health`, `GET /health/detailed` (Admin)
