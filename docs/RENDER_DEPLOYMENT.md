# Render Deployment (Backend API) - Click-by-Click

Deploy `apps/api` to Render first.

---

## Step 1: Create Web Service

1. Open https://dashboard.render.com
2. Click **New +**.
3. Click **Web Service**.
4. Connect your GitHub repo.
5. Fill fields:
   - **Name**: `openforum-api`
   - **Root Directory**: `apps/api`
   - **Runtime**: `Rust`
   - **Build Command**: `cargo build --release`
   - **Start Command**: `./target/release/openforum-api`
6. Click **Create Web Service**.

---

## Step 2: Add environment variables

1. Open your Render service.
2. Go to **Environment** tab.
3. Click **Add Environment Variable**.
4. Add each key below exactly.

Key | Value source | Example
--- | --- | ---
`PORT` | Render default | `10000`
`RUST_LOG` | Manual | `openforum_api=debug,tower_http=debug`
`NEXT_PUBLIC_FRONTEND_URL` | Vercel URL (or temp) | `http://localhost:3000` initially
`NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings -> API Keys | `https://<project>.supabase.co`
`AXUM_JWT_SECRET` | Supabase Settings -> JWT Keys -> Legacy JWT Secret | `<copied secret>`
`GOOGLE_SHEETS_ID` | Google Sheet URL | `<sheet-id>`
`GOOGLE_SERVICE_ACCOUNT_JSON` | `jq -c` output from service account JSON | `{...}` one line
`GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder URL | `<folder-id>`
`UPSTASH_REDIS_URL` | Upstash console | `redis://default:...@...:6379`
`UPSTASH_REDIS_TOKEN` | Upstash console | `<token>`

Important: startup is strict; missing/empty required vars will crash boot.

---

## Step 3: Deploy and monitor logs

1. Click **Manual Deploy** (if needed) or push commit.
2. Open **Logs** tab.
3. Wait for successful boot message.

If you see missing env var error, add the exact missing key and redeploy.

---

## Step 4: Health check

Open in browser:

```text
https://<your-render-service>/health
```

Expected: `status: ok` response.

Then test:

```text
https://<your-render-service>/api/v1/articles
```

Expected: non-5xx response.

---

## Step 5: After Vercel is ready

Update this Render env var:

- `NEXT_PUBLIC_FRONTEND_URL=https://<your-vercel-domain>`

Then redeploy backend once.

---

## Common mistakes

- Wrong Root Directory (must be `apps/api`)
- Pasting multi-line JSON (must be one-line `jq -c` output)
- Not sharing Sheet/Drive folder with service account email
- Using publishable key instead of JWT secret for `AXUM_JWT_SECRET`
