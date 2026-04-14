# Deployment Checklist (OpenForum)

Use this checklist for production rollout.

---

## 1. Credentials Ready

- [ ] Supabase URL / Anon Key / JWT Secret
- [ ] Google service account JSON
- [ ] Google Sheet shared with service account
- [ ] Google Drive folder shared with service account
- [ ] Upstash Redis URL + token

See: `docs/CREDENTIALS_GUIDE.md`

---

## 2. Backend (Render)

- [ ] Create `openforum-api` Web Service
- [ ] Root directory = `apps/api`
- [ ] Build command = `cargo build --release`
- [ ] Start command = `./target/release/openforum-api`
- [ ] Set all required env vars
- [ ] Verify `/health` and `/api/v1/articles`

See: `docs/RENDER_DEPLOYMENT.md`

---

## 3. Frontend (Vercel)

- [ ] Create project with root directory `apps/web`
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Set `NEXT_PUBLIC_API_URL` to Render URL
- [ ] Deploy and verify login + `/articles`

See: `docs/VERCEL_DEPLOYMENT.md`

---

## 4. Supabase Redirects

- [ ] Add production callback URL: `https://<vercel-domain>/auth/callback`
- [ ] Keep local callback URL for development

---

## 5. Final Validation

- [ ] Login success path redirects to `/articles`
- [ ] `/feed` and `/article/*` legacy redirects work
- [ ] Article create works
- [ ] Image upload works with auth token
- [ ] API logs clean on Render
