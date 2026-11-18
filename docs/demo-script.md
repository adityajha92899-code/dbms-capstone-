# FleetFlow TMS — 5-Minute Viva Demo Script

1. **0:00 – 0:45 (Architecture & Database):**
   - Show `docker-compose.yml` and `backend/db/schema.sql` (14 tables, 3NF, UUID PKs, `tstzrange` overlap trigger, license validity trigger).
2. **0:45 – 1:45 (Admin Operations & Live Telemetry):**
   - Log in via the **Admin** demo chip on `/login`.
   - Highlight the 4 live KPIs, Leaflet map with pulsing active-trip markers, and Recharts analytics on `/admin/dashboard`.
3. **1:45 – 2:45 (Dispatch & Trigger Protection):**
   - Open `/admin/trips`, demonstrate Kanban drag-and-drop and the 3-step **Schedule Trip** wizard.
   - Show a `409 Conflict` when attempting to double-book a vehicle.
4. **2:45 – 3:45 (Driver & Customer Portals):**
   - Log in as **Driver** (`driver1@tms.com`) → start/complete an assigned trip.
   - Log in as **Customer** (`customer1@tms.com`) → submit a booking via the 3-step wizard and print/download an invoice.
5. **3:45 – 5:00 (Reports, Audit, Swagger & Tests):**
   - Show `/admin/reports` (CSV export), `/admin/audit`, `/api-docs` (Swagger UI), and `npm test` passing.
