# PARCELBRIDGE

**Tagline:** *"Your Parcels. Your Time. Your Convenience."*

PARCELBRIDGE is an independent startup product concept: a **Universal E-commerce Parcel Management and Scheduled Last-Mile Delivery Platform** connecting courier drop-offs, residential society parcel hubs, delivery personnel, and residents.

> **Ecosystem Note:** References to e-commerce marketplaces (e.g., Amazon, Flipkart, Meesho, Myntra) or courier networks represent proposed integration architecture and target compatibility, not existing commercial partnerships.

---

## Architecture Overview

```text
Vercel Frontend (Next.js 15 / React 19 / TypeScript / Tailwind)
       │  HTTPS REST (/api/v1)
       ▼
Render Backend (Node.js / Express / TypeScript)
       │  Supabase Service-Role Client (Server-Side Only)
       ▼
Supabase PostgreSQL (18 Tables, RLS, Atomic RPCs, Private Storage)
```

### Repository Structure
- **`frontend/`**: Next.js 15 App Router (`app/`, `components/`, `dashboards/`, `services/`, `hooks/`, `vercel.json`)
- **`backend/`**: Express REST API (`src/controllers/`, `src/routes/`, `src/middleware/`, `src/services/`, `src/validators/`, `src/config/`, `src/scripts/`, `render.yaml`)
- **`database/`**: PostgreSQL migrations (`database/migrations/202611250001`–`0004`), `schema.sql`, and `seed.sql` (`is_demo = TRUE`)
- **`docs/`**: [SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md), [DEPLOYMENT.md](./docs/DEPLOYMENT.md), [API.md](./docs/API.md), [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

---

## Security Highlights
- **6-Role RBAC & Supabase RLS**: `super_admin`, `society_admin`, `hub_manager`, `delivery_personnel`, `customer`, and `business_partner`.
- **IDOR Protection**: Customers access only their own parcels; delivery personnel access only their assigned deliveries.
- **Zero-PII QR Codes**: `pb1:<parcelId>:<hmac>` tokens never expose names, flats, or phone numbers.
- **Hashed OTP Handover**: 6-digit OTPs are HMAC-SHA256 hashed, expire in 30 minutes, lock after 5 failed attempts, and are protected by a dedicated rate limiter.
- **Atomic Slot Scheduling**: `reserve_delivery_slot` and `cancel_delivery_booking` PostgreSQL RPCs use `FOR UPDATE` row locks to prevent overbooking.
- **Production Guards**: `NODE_ENV=production` refuses `STORAGE_DRIVER=memory` and missing secrets.

---

## Local Development

### 1. Backend
```powershell
cd backend
Copy-Item .env.example .env
# Edit .env with your local or Supabase settings
npm.cmd install
npm.cmd run dev
```
API runs at `http://localhost:4000/api/v1` and Swagger UI at `http://localhost:4000/api/docs`.

### 2. Frontend
```powershell
cd frontend
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```
Frontend runs at `http://localhost:3000`.

---

## End-to-End Demonstration Flow
1. **Public Portal**: Visit `/` (Hero, How It Works, Features, For E-Commerce, For Societies, Track Parcel `/track`, Partnership `/partnership`).
2. **Hub Intake & QR Scan**: Log in as Admin/Hub Manager (`/dashboard/admin`) to inspect KPIs, scan opaque QR tokens, and manage parcel statuses.
3. **Resident Scheduling**: Log in as Resident (`/dashboard/customer`) to view incoming parcels, reserve a 2-hour delivery window, request returns, or open support tickets.
4. **OTP Handover**: Log in as Delivery Staff (`/dashboard/delivery`) to view assigned flat deliveries and confirm handover with the 6-digit OTP.

## Known Limitations
- External e-commerce/courier integrations use authenticated webhook interfaces (`POST /api/v1/webhooks/courier-event`) and await live partner credentials.
- Live cloud deployment requires your Supabase, Render, and Vercel account authorizations.
