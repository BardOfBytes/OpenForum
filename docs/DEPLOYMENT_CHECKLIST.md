# Deployment Checklist (Beginner Friendly)

Follow in this exact order.

---

## Phase 1: Supabase first

- [X] Create Supabase project
- [X] Run `supabase/migrations/001_create_profiles.sql` in SQL Editor
- [X] Set Auth URL config:
  - `http://localhost:3000`
  - `http://localhost:3000/auth/callback`
  - `https://*.vercel.app/auth/callback`
- [X] Copy keys:
  - Project URL
  - Publishable key
  - Legacy JWT secret

Reference: `docs/SUPABASE_SETUP.md`

---

## Phase 2: Database, Cloudinary, and Upstash credentials

- [X] Create/verify Supabase public schema tables
- [X] Copy `DATABASE_URL`
- [X] Copy Cloudinary values:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_UPLOAD_FOLDER`
- [X] Create Upstash Redis DB
- [X] Copy:
  - `UPSTASH_REDIS_URL`
  - `UPSTASH_REDIS_TOKEN`

Reference: `docs/CREDENTIALS_GUIDE.md`, `docs/UPSTASH_REDIS_SETUP.md`

---

## Phase 3: Deploy backend on Render

- [X] Create Render Web Service (`apps/api`)
- [X] Build command: `cargo build --release`
- [X] Start command: `./target/release/openforum-api`
- [ ] Paste all required backend env vars
- [ ] Confirm `/health` works

Reference: `docs/RENDER_DEPLOYMENT.md`

---

## Phase 4: Deploy frontend on Vercel

- [ ] Create Vercel project (`apps/web`)
- [ ] Paste frontend env vars
- [ ] Deploy
- [ ] Copy final Vercel domain

Reference: `docs/VERCEL_DEPLOYMENT.md`

---

## Phase 5: Final sync

- [ ] Update Supabase Site URL to final Vercel domain
- [ ] Add final callback URL in Supabase
- [ ] Update Render `NEXT_PUBLIC_FRONTEND_URL` to final Vercel domain
- [ ] Redeploy backend once

---

## Phase 6: Smoke test

- [ ] Login works
- [ ] Redirect lands on `/articles`
- [ ] `/feed` and `/article/*` redirect correctly
- [ ] Article creation works
- [ ] Image upload works
