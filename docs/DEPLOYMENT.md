# Production Deployment Guide (GitHub + Supabase + Render + Vercel)

## 1. GitHub Repository
Push the repository to GitHub. Ensure `.env` and `.env.local` are never committed (`.gitignore` excludes them).

## 2. Supabase (Database)
Complete [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) first so all 18 tables, RLS policies, atomic RPCs, and storage buckets are live.

## 3. Render (Backend API)
1. In Render, click **New + → Web Service** and connect your GitHub repository.
2. Set **Root Directory** to `backend`.
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start`
5. **Health Check Path**: `/api/v1/health`
6. Set required Environment Variables:
   - `NODE_ENV=production`
   - `STORAGE_DRIVER=supabase` (enforced in production)
   - `DEMO_MODE=false`
   - `FRONTEND_URL=https://your-vercel-app.vercel.app`
   - `SUPABASE_URL=<your-supabase-project-url>`
   - `SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>`
   - `JWT_SECRET`, `QR_HMAC_SECRET`, `OTP_HMAC_SECRET`, `WEBHOOK_SHARED_SECRET` (64+ char random strings)

## 4. Vercel (Frontend)
1. In Vercel, click **Add New → Project** and import your GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Vercel automatically uses `frontend/vercel.json`.
4. Set Environment Variables:
   - `NEXT_PUBLIC_API_URL=https://your-render-api.onrender.com/api/v1`
   - `NEXT_PUBLIC_DEMO_MODE=false`
5. Deploy and verify:
   - `GET https://your-render-api.onrender.com/api/v1/health` returns `{"status":"ok","database":"connected"}`.
   - `https://your-vercel-app.vercel.app/track` loads and queries the live Render API.
