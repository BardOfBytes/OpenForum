# Vercel Deployment (Frontend) - Click-by-Click

Deploy `apps/web` after backend is live.

---

## Step 1: Create Vercel project

1. Open https://vercel.com/dashboard
2. Click **Add New... -> Project**.
3. Import this GitHub repository.
4. Configure:
   - **Root Directory**: `apps/web`
   - **Framework**: Next.js
   - **Install Command**: `pnpm install --frozen-lockfile`
   - **Build Command**: `pnpm run build`
5. Click **Deploy**.

---

## Step 2: Add environment variables

1. Open Vercel project.
2. Go to **Settings -> Environment Variables**.
3. Add each variable for `Production`, `Preview`, and `Development`.

Key | Value source | Example
--- | --- | ---
`NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings -> API Keys | `https://<project>.supabase.co`
`NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Publishable key | `sb_publishable_...`
`NEXT_PUBLIC_API_URL` | Render backend URL | `https://<render-service>.onrender.com`

Optional server-only key:
- `SUPABASE_SERVICE_KEY` (do not expose as `NEXT_PUBLIC_*`).

4. Click **Save**.
5. Redeploy from **Deployments** tab.

---

## Step 3: Update Supabase callback URLs

After Vercel gives your final domain:

1. Open Supabase -> **Authentication -> URL Configuration**.
2. Add redirect URL:

```text
https://<your-vercel-domain>/auth/callback
```

3. Set Site URL:

```text
https://<your-vercel-domain>
```

Keep local callback too:

```text
http://localhost:3000/auth/callback
```

---

## Step 4: Verify app flow

1. Open Vercel URL.
2. Click **Sign in**.
3. Complete OAuth.
4. Confirm redirect to `/articles`.
5. Confirm articles list loads from backend.

---

## Common mistakes

- Missing `NEXT_PUBLIC_API_URL`
- Wrong Supabase callback URL
- Backend CORS not updated (`NEXT_PUBLIC_FRONTEND_URL` on Render)
