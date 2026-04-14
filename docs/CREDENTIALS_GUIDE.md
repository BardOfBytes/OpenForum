# Credentials & API Integration Guide

This guide covers all credentials needed to run OpenForum in production.

---

## 1. Supabase (Auth + Profiles)

OpenForum web auth and API token validation depend on Supabase.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and create a project.
2. Open **Settings > API** and collect:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `AXUM_JWT_SECRET` (JWT Secret)
3. Run SQL migration in Supabase SQL Editor:
   - File: `supabase/migrations/001_create_profiles.sql`
4. Configure OAuth provider(s):
   - **Authentication > Providers > Google** (and GitHub if needed)
5. Add callback/redirect URLs in **Authentication > URL Configuration**:
   - Local: `http://localhost:3000/auth/callback`
   - Production: `https://<your-vercel-domain>/auth/callback`

> Note: Domain restriction (`@csvtu.ac.in`) is enforced in the app callback logic.

---

## 2. Google Cloud (Sheets + Drive)

OpenForum API stores article metadata in Google Sheets and uploads media to Google Drive.

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select project.
3. Enable APIs:
   - **Google Sheets API**
   - **Google Drive API**
4. Create service account:
   - **IAM & Admin > Service Accounts > Create Service Account**
5. Create JSON key:
   - Service account > **Keys > Add Key > Create new key > JSON**
6. Share resources with service account email (`client_email` in JSON):
   - Share target Sheet as **Editor**.
   - Share target Drive folder as **Editor**.
7. Collect resource IDs:
   - `GOOGLE_SHEETS_ID`: from Google Sheet URL
   - `GOOGLE_DRIVE_FOLDER_ID`: from Drive folder URL

### Convert JSON to env-safe single line

Run locally:

```bash
jq -c . /path/to/service-account.json
```

Use output as `GOOGLE_SERVICE_ACCOUNT_JSON`.

---

## 3. Upstash Redis (Cache)

OpenForum API uses Upstash Redis for cache-aside article caching.

1. Create DB at [Upstash Console](https://console.upstash.com/redis).
2. Collect:
   - `UPSTASH_REDIS_URL` (Redis URL form)
   - `UPSTASH_REDIS_TOKEN`
3. Expected URL format:

```bash
redis://default:<token>@<host>:6379
```

---

## 4. Environment Variable Matrix

### Web (Vercel)

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` (Render backend URL)

Optional:
- `SUPABASE_SERVICE_KEY`

### API (Render)

Required (fail-fast at boot):
- `NEXT_PUBLIC_FRONTEND_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `AXUM_JWT_SECRET`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_DRIVE_FOLDER_ID`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`

Recommended:
- `RUST_LOG=openforum_api=debug,tower_http=debug`

---

## 5. Security Notes

- Never commit real `.env` values.
- Rotate Supabase, Google, and Upstash secrets if exposed.
- Keep service account access scoped only to required Sheet and Drive folder.
