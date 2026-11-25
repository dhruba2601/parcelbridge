# PARCELBRIDGE REST API Reference

Base URL: `/api/v1`
Interactive Swagger UI: `/api/docs` (JSON spec at `/api/openapi.json`)

## Authentication
- `POST /auth/register` — Register customer or partner account
- `POST /auth/login` — Authenticate and receive JWT
- `POST /auth/logout` — End session
- `GET /auth/me` — Get current user profile (Bearer JWT)
- `PATCH /auth/me` — Update resident society/flat/profile

## Parcels & QR Workflow
- `GET /parcels` — List parcels (scoped by role)
- `POST /parcels` — Register incoming parcel (`super_admin`, `hub_manager`, `society_admin`)
- `GET /parcels/:id` — Get parcel details, audit timeline & QR code
- `PATCH /parcels/:id/status` — Transition parcel lifecycle status
- `GET /parcels/track/:trackingId` — Public tracking lookup (non-PII)
- `POST /parcels/scan-qr` — Verify HMAC-signed opaque QR token (`pb1:<id>:<sig>`)

## Delivery Scheduling Engine
- `GET /delivery-slots` — List available slots by `societyId` and `date`
- `POST /delivery-slots` — Create delivery slot (`super_admin`, `hub_manager`, `society_admin`)
- `GET /delivery-bookings` — List bookings
- `POST /delivery-bookings` — Atomically reserve a slot
- `PATCH /delivery-bookings/:id` — Reschedule booking atomically
- `DELETE /delivery-bookings/:id` — Cancel booking and release slot capacity

## Delivery Personnel & OTP Handover
- `GET /delivery/assignments` — List assigned deliveries for logged-in staff
- `POST /delivery/dispatch` — Assign parcel and issue hashed 6-digit OTP
- `POST /delivery/verify-otp` — Verify handover OTP
- `POST /delivery/confirm` — Verify OTP and mark parcel `Delivered`
- `POST /delivery/fail` — Report failed delivery attempt

## Administration & Partners
- `GET /admin/dashboard` — Operational KPIs & recent parcels
- `GET /admin/analytics` — Metrics summary
- `POST /admin/societies` — Register residential society
- `POST /admin/hubs` — Create parcel hub
- `POST /partners/apply` — Submit partnership enquiry
- `GET /partners/applications` — List applications
- `POST /webhooks/courier-event` — HMAC-SHA256 signed partner webhook endpoint
