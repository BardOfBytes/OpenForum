# Vercel Deployment Guide (Frontend)

Deploy OpenForum web app (`apps/web`) on Vercel.

---

## 1. Prerequisites

- Backend already deployed on Render (you need API URL)
- Supabase project configured

Reference: `docs/CREDENTIALS_GUIDE.md`, `docs/RENDER_DEPLOYMENT.md`

---

## 2. Create Vercel Project

1. Open [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New > Project** and import this repository.
3. Configure project:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: `Next.js`
   - **Install Command**: `pnpm install --frozen-lockfile`
   - **Build Command**: `pnpm run build`
   - **Output Directory**: leave default for Next.js

---

## 3. Environment Variables (Required)

Set in Vercel (Production + Preview):

- `NEXT_PUBLIC_SUPABASE_URL` = `https://<your-project>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<anon-key>`
- `NEXT_PUBLIC_API_URL` = `https://<your-render-service>`

Optional:
- `SUPABASE_SERVICE_KEY`

---

## 4. Supabase Redirect URLs

After Vercel deploy gives your domain, update Supabase:

1. Go to **Supabase > Authentication > URL Configuration**
2. Add:
   - `https://<your-vercel-domain>/auth/callback`

For local dev keep:
- `http://localhost:3000/auth/callback`

---

## 5. Deploy + Verify

1. Trigger Vercel deployment.
2. Verify:
   - Home page loads.
   - Login OAuth returns to `/auth/callback` then redirects to `/articles`.
   - Articles list loads from API.

---

## 6. Common Issues

- **Auth callback error**: Supabase redirect URL missing/mismatch.
- **Articles fail to load**: `NEXT_PUBLIC_API_URL` incorrect or backend down.
- **CORS errors**: backend `NEXT_PUBLIC_FRONTEND_URL` not set to Vercel domain.
