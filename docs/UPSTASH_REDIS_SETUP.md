# Upstash Redis Setup Guide (Caching)

OpenForum API uses Redis cache-aside for article list/detail performance.

---

## 1. Create Redis Database

1. Open [Upstash Redis Console](https://console.upstash.com/redis).
2. Click **Create Database**.
3. Choose a region close to your Render backend region.
4. Create DB.

---

## 2. Collect Credentials

From Upstash database details, copy:

- Redis endpoint/URL (`UPSTASH_REDIS_URL`)
- Redis token/password (`UPSTASH_REDIS_TOKEN`)

Expected URL format:

```bash
redis://default:<token>@<host>:6379
```

---

## 3. Configure Render API Service

Set in Render environment variables:

- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`

Then redeploy API.

---

## 4. Validate Cache Is Working

1. Call `GET /api/v1/articles` repeatedly.
2. Ensure responses are stable and faster on repeated hits.
3. Create an article (`POST /api/v1/articles`) and verify list reflects updates after cache invalidation.

---

## 5. Troubleshooting

- **Redis auth failed**: token mismatch.
- **Connection errors**: wrong URL scheme/host/port.
- **No caching effect**: missing env vars or service restarted without vars.
