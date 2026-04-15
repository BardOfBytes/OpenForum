# Supabase Setup (Click-by-Click)

This is the exact setup for OpenForum.

---

## Step 1: Create project

1. Open https://supabase.com/dashboard
2. Click **New project**.
3. Choose organization.
4. Enter project name (example: `OpenForum`).
5. Set DB password and region.
6. Wait until status is healthy.

---

## Step 2: Run SQL migration

1. Left menu -> **SQL Editor**.
2. Click **New query**.
3. Run migration file:
   - `supabase/migrations/001_create_profiles.sql`
4. Copy full SQL from the file, paste into SQL Editor, and click **Run**.
5. You should see success in results.
6. Verify table exists:

```sql
select tablename
from pg_tables
where schemaname='public' and tablename='profiles';
```

Expected result: one row `profiles`.

---

## Step 3: Configure auth URLs (before Vercel deploy)

If you do not have final Vercel URL yet, use temporary values.

1. Left menu -> **Authentication -> URL Configuration**.
2. Set **Site URL** to:

```text
http://localhost:3000
```

3. In **Redirect URLs**, add:

```text
http://localhost:3000/auth/callback
https://*.vercel.app/auth/callback
```

After frontend is deployed, add your exact domain:

```text
https://<your-project>.vercel.app/auth/callback
```

Then update **Site URL** to:

```text
https://<your-project>.vercel.app
```

---

## Step 4: Configure sign-in providers

1. Left menu -> **Authentication -> Sign In / Providers**.
2. Enable **Google** and **GitHub**.
3. Save changes.

### 4.1 Google OAuth setup

1. Open Google Cloud Console: https://console.cloud.google.com
2. Create/select your project.
3. Go to **APIs & Services -> Credentials**.
4. Create **OAuth client ID** (type: **Web application**).
5. Add redirect URI:

```text
https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
```

6. Copy Google **Client ID** and **Client Secret**.
7. Paste them into Supabase Google provider config and save.

### 4.2 GitHub OAuth setup

1. Open GitHub -> **Settings -> Developer settings -> OAuth Apps**.
2. Click **New OAuth App**.
3. Set **Homepage URL** to your app URL (for local dev: `http://localhost:3000`).
4. Set **Authorization callback URL**:

```text
https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
```

5. Create app and copy **Client ID** + generate **Client Secret**.
6. Paste these into Supabase GitHub provider config and save.

---

## Step 5: Copy keys and paste to env vars

### 5.1 API keys page

1. Left menu -> **Settings -> API Keys**.
2. Copy:
   - Project URL
   - Publishable key (`sb_publishable_...`)

Paste:
- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 5.2 JWT secret page

1. Left menu -> **Settings -> JWT Keys**.
2. Open **Legacy JWT Secret** tab.
3. Click **Reveal**.
4. Copy secret.

Paste:
- `AXUM_JWT_SECRET` (Render backend env)

---

## Step 6: Do NOT use this

- Do not enable **OAuth Server** (Authentication -> OAuth Server) for this project.
- Do not put `sb_secret_...` in `NEXT_PUBLIC_*` env vars.

---

## Step 7: Verify login flow

After backend + frontend env vars are set:

1. Open app `/login`.
2. Sign in.
3. Confirm redirect to `/articles`.
4. If auth fails, check callback URLs again.

Common callback errors:
- `missing_code`: redirect URL mismatch
- `exchange_failed`: provider/client config mismatch
- `domain`: expected for non-institutional users (allowed: `@csvtu.ac.in`, `@students.csvtu.ac.in`)
