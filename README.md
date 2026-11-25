# PARCELBRIDGE

**Tagline:** *"Your Parcels. Your Time. Your Convenience."*

Universal E-commerce Parcel Management and Scheduled Last-Mile Delivery Platform.

## Architecture

- **Frontend (`frontend/`)**: Next.js 15 (App Router) + React + TypeScript + Tailwind CSS — deployed independently on **Vercel**.
- **Backend (`backend/`)**: Node.js + Express.js + TypeScript REST API (`/api/v1`) with JWT auth, RBAC, Zod validation, rate limiting, Helmet, CORS, and Swagger/OpenAPI (`/api/docs`) — deployed independently on **Render**.
- **Database (`supabase/`)**: Supabase PostgreSQL with 18 normalized tables, Row Level Security (RLS), atomic slot-reservation RPC (`reserve_delivery_slot`), and demo seed scripts.

## Quick Start (Local Development)

### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
API runs at `http://localhost:4000/api/v1` and Swagger UI at `http://localhost:4000/api/docs`.

### 2. Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Frontend runs at `http://localhost:3000`.

### 3. Demo Accounts (when `DEMO_MODE=true`)
Password for all demo accounts: `DemoPass@2026`
- Resident (Customer): `customer.demo@parcelbridge.io`
- Super Admin: `admin.demo@parcelbridge.io`
- Hub Manager: `hub.demo@parcelbridge.io`
- Delivery Staff: `delivery.demo@parcelbridge.io`
- Business Partner: `partner.demo@parcelbridge.io`

## Documentation
- [Supabase Setup Guide](./docs/SUPABASE_SETUP.md)
- [Deployment Guide (Vercel + Render)](./docs/DEPLOYMENT.md)
- [REST API & Webhook Reference](./docs/API.md)
- [Production Troubleshooting Guide](./docs/TROUBLESHOOTING.md)
