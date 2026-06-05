# Credentials Guide (Beginner Friendly)

Use this document to collect every value you must copy once and paste into Vercel/Render.

If you are new: do this in order.

---

## 1. Supabase Values

### 1.1 Open API Keys page

1. Go to https://supabase.com/dashboard
2. Open your project.
3. Left menu: **Settings -> API Keys**.
4. Keep this tab open.

### 1.2 Copy these values

Copy from Supabase | Paste into env var | Where to set
--- | --- | ---
Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Vercel + Render
Publishable key (`sb_publishable_...`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel
Secret key (`sb_secret_...`) optional | `SUPABASE_SERVICE_KEY` | Server only (never in `NEXT_PUBLIC_*`)

### 1.3 Copy JWT secret for backend

1. Left menu: **Settings -> JWT Keys**.
2. Open **Legacy JWT Secret** tab.
3. Click **Reveal**.
4. Copy this value.
5. Paste into env var: `AXUM_JWT_SECRET` (Render backend).

---

## 2. Database And Cloudinary Values

### 2.1 Copy database connection string

Copy your Supabase/Neon Postgres connection string into:

- `DATABASE_URL`

Use an SSL-enabled connection string in production.

### 2.2 Copy Cloudinary credentials

Go to https://console.cloudinary.com/app/settings/api-keys and copy:

Copy from Cloudinary | Paste into env var | Where to set
--- | --- | ---
Cloud name | `CLOUDINARY_CLOUD_NAME` | Render
API key | `CLOUDINARY_API_KEY` | Render
API secret | `CLOUDINARY_API_SECRET` | Render
Upload folder | `CLOUDINARY_UPLOAD_FOLDER` | Render

---

## 3. Upstash Redis Values

1. Go to https://console.upstash.com/redis
2. Create database.
3. Open DB details.
4. Copy:
   - Redis URL -> `UPSTASH_REDIS_URL`
   - Token/password -> `UPSTASH_REDIS_TOKEN`

Expected URL format:

```bash
redis://default:<token>@<host>:6379
```

Set both on Render backend.

---

## 4. Final Env Mapping (Quick)

### Vercel (frontend)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

Optional server-side only:
- `SUPABASE_SERVICE_KEY`

### Render (backend)

- `PORT`
- `RUST_LOG`
- `NEXT_PUBLIC_FRONTEND_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `AXUM_JWT_SECRET`
- `DATABASE_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`

---

## 5. Safety

- Never put secret keys into `NEXT_PUBLIC_*` variables.
- Never commit `.env` files.
- Rotate keys immediately if exposed publicly.
