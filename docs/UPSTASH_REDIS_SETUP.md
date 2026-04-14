# Upstash Redis Setup (Click-by-Click)

This creates cache credentials for Render backend.

---

## Step 1: Create Upstash DB

1. Open https://console.upstash.com/redis
2. Click **Create Database**.
3. Choose a name and region.
4. Click **Create**.

Tip: choose region near your Render backend region.

---

## Step 2: Copy connection values

1. Open your new Redis database page.
2. Copy:
   - `Redis URL` -> use for `UPSTASH_REDIS_URL`
   - `Token` (or password) -> use for `UPSTASH_REDIS_TOKEN`

Expected URL format:

```text
redis://default:<token>@<host>:6379
```

---

## Step 3: Paste into Render

1. Open Render backend service.
2. Go to **Environment**.
3. Add:
   - `UPSTASH_REDIS_URL`
   - `UPSTASH_REDIS_TOKEN`
4. Redeploy backend.

---

## Step 4: Basic verification

1. Call backend endpoint multiple times:

```text
GET /api/v1/articles
```

2. Confirm no Redis auth/connection errors in Render logs.

---

## Common mistakes

- Copying REST URL instead of Redis URL
- Missing token
- Wrong region causing high latency
