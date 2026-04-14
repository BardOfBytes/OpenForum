# Render Deployment Guide (Backend API)

Deploy OpenForum API (`apps/api`) on Render Web Service.

---

## 1. Prerequisites

- GitHub repo connected to Render
- Supabase project configured
- Google service account + shared Sheet/Drive folder
- Upstash Redis database

Reference: `docs/CREDENTIALS_GUIDE.md`

---

## 2. Create Render Web Service

1. Open [Render Dashboard](https://dashboard.render.com/).
2. Click **New + > Web Service**.
3. Connect repository.
4. Configure service:
   - **Name**: `openforum-api`
   - **Root Directory**: `apps/api`
   - **Runtime**: `Rust`
   - **Build Command**: `cargo build --release`
   - **Start Command**: `./target/release/openforum-api`
5. Set **Health Check Path**: `/health`

---

## 3. Environment Variables (Required)

Add these in Render service environment:

- `PORT` = `10000` (or leave Render default)
- `RUST_LOG` = `openforum_api=debug,tower_http=debug`
- `NEXT_PUBLIC_FRONTEND_URL` = `https://<your-vercel-domain>`
- `NEXT_PUBLIC_SUPABASE_URL` = `https://<your-project>.supabase.co`
- `AXUM_JWT_SECRET` = `<supabase-jwt-secret>`
- `GOOGLE_SHEETS_ID` = `<sheet-id>`
- `GOOGLE_SERVICE_ACCOUNT_JSON` = `<single-line-json>`
- `GOOGLE_DRIVE_FOLDER_ID` = `<drive-folder-id>`
- `UPSTASH_REDIS_URL` = `redis://default:<token>@<host>:6379`
- `UPSTASH_REDIS_TOKEN` = `<upstash-token>`

> Important: API startup fails if required vars are missing/empty.

---

## 4. Deploy + Verify

After first deploy, verify:

1. `GET https://<render-service>/health` returns `200`.
2. `GET https://<render-service>/api/v1/articles` returns non-5xx.
3. Check Render logs for boot errors around missing env vars.

---

## 5. Common Issues

- **Boot fails immediately**: one or more required env vars missing.
- **403/404 from Google APIs**: service account not shared on Sheet/Drive folder.
- **CORS blocked**: `NEXT_PUBLIC_FRONTEND_URL` does not match your Vercel domain.
- **Upload errors**: invalid Drive folder ID or invalid `GOOGLE_SERVICE_ACCOUNT_JSON`.

---

## 6. Post-Deploy

After backend URL is live:

- Set `NEXT_PUBLIC_API_URL=https://<render-service>` in Vercel frontend project.
- Redeploy frontend.
