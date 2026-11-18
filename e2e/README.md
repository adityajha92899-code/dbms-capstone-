# FleetFlow TMS — End-to-End (Playwright) Happy-Path Guide

## Happy-Path Flow

1. **Admin Login (`admin@tms.com`)** → Navigate to `/admin/trips`, open **Schedule Trip** wizard, select Route + Vehicle + Driver + Pending Booking, and submit (`POST /api/v1/trips`).
2. **Admin Logout** → Click Avatar → **Sign out**.
3. **Driver Login (`driver1@tms.com`)** → On `/driver/dashboard`, click **Start Trip** (`PATCH /api/v1/trips/:id/status` `{ status: "in_progress" }`), then click **Mark Delivered** (`{ status: "completed" }`).
4. **Driver Logout** → Sign out.
5. **Customer Login (`customer1@tms.com`)** → On `/customer/dashboard`, verify the booking appears under **Recent Deliveries** with status `delivered`.

## Running Playwright

```bash
npx playwright test e2e/happy-path.spec.js
```
