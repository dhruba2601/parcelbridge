# Production Troubleshooting Guide

| Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| `CORS origin not allowed` in browser | `FRONTEND_URL` on Render does not match the exact Vercel domain | Update `FRONTEND_URL` on Render (include `https://`, no trailing slash). |
| `401 Invalid or expired authentication token` | `JWT_SECRET` rotated or missing in Render env vars | Ensure a persistent `JWT_SECRET` is set in Render Environment Variables. |
| `409 SLOT_CAPACITY_FULL` | Two users booked the last slot simultaneously | Expected atomic protection; prompt user to choose another window. |
| `429 OTP_LOCKED` | 5 failed OTP verification attempts | Re-dispatch parcel (`POST /api/v1/delivery/dispatch`) to issue a fresh OTP. |
| `500 DB_ERROR` on Render | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` missing or migrations not applied | Verify Render env vars and confirm all 3 SQL migrations ran in Supabase. |
