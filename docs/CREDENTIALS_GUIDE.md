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

## 2. Google Values (Sheets + Drive)

### 2.1 Enable APIs in Google Cloud

1. Go to https://console.cloud.google.com
2. Create/select project.
3. Enable:
   - Google Sheets API
   - Google Drive API

### 2.2 Create service account JSON

1. Go to **IAM & Admin -> Service Accounts**.
2. Click **Create Service Account**.
3. Open the created account.
4. Tab **Keys -> Add Key -> Create new key -> JSON**.
5. Download the JSON file.

### 2.3 Share access with service account email

1. Open JSON file and copy `client_email`.
2. Open your Google Sheet -> **Share** -> paste email -> role **Editor**.
3. Open your Drive folder -> **Share** -> paste email -> role **Editor**.

### 2.4 Copy IDs

Copy from Google | Paste into env var | Where to set
--- | --- | ---
Sheet URL ID | `GOOGLE_SHEETS_ID` | Render
Drive folder URL ID | `GOOGLE_DRIVE_FOLDER_ID` | Render
JSON content (single line) | `GOOGLE_SERVICE_ACCOUNT_JSON` | Render

Convert JSON to one line:

```bash
jq -c . /path/to/service-account.json
```

Paste the output into `GOOGLE_SERVICE_ACCOUNT_JSON`.

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
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_DRIVE_FOLDER_ID`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`

---

## 5. Safety

- Never put secret keys into `NEXT_PUBLIC_*` variables.
- Never commit `.env` files.
- Rotate keys immediately if exposed publicly.
