//! Redis cache-aside helpers.
//!
//! The cache is a best-effort optimization, never a hard dependency. When Redis
//! is unconfigured or unreachable the service degrades to a no-op: reads miss,
//! writes are dropped, and the rate limiter fails open. The API stays usable.
//!
//! Connections are managed by a single shared [`ConnectionManager`], which
//! multiplexes commands over one connection and transparently reconnects after
//! a drop. Credentials are carried in the connection URL so that reconnects
//! re-authenticate automatically.

use anyhow::{Context, Result};
use redis::aio::ConnectionManager;
use serde::{Serialize, de::DeserializeOwned};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::OnceCell;

/// How long to wait for a Redis connection before giving up.
///
/// Deliberately short: the cache is optional, and the rate limiter that uses
/// it runs in front of every `/api/v1` route. A slow cache must never become a
/// slow API.
const CONNECT_TIMEOUT: Duration = Duration::from_millis(1500);

/// How long to wait for a single Redis command.
const OP_TIMEOUT: Duration = Duration::from_millis(1000);

/// Cache key prefixes to avoid collisions.
pub mod keys {
    /// Cache key for the article feed list.
    pub fn article_list(page: u32, per_page: u32, category: Option<&str>) -> String {
        match category {
            Some(cat) => format!("articles:list:{}:{}:{}", cat, page, per_page),
            None => format!("articles:list:all:{}:{}", page, per_page),
        }
    }

    /// Cache key for article list total count.
    pub fn article_count(category: Option<&str>) -> String {
        match category {
            Some(cat) => format!("articles:count:{}", cat),
            None => "articles:count:all".to_string(),
        }
    }

    /// Cache key for a single article by slug.
    pub fn article_by_slug(slug: &str) -> String {
        format!("articles:slug:{}", slug)
    }

    /// Cache key for a user profile.
    pub fn user_profile(user_id: &str) -> String {
        format!("users:profile:{}", user_id)
    }
}

/// Default cache TTLs.
pub mod ttl {
    use std::time::Duration;

    /// Article list cache: 2 minutes.
    pub const ARTICLE_LIST: Duration = Duration::from_secs(120);
    /// Article count cache: 2 minutes.
    pub const ARTICLE_COUNT: Duration = Duration::from_secs(120);
    /// Single article cache: 5 minutes.
    pub const ARTICLE_DETAIL: Duration = Duration::from_secs(300);
    /// User profile cache: 10 minutes.
    pub const USER_PROFILE: Duration = Duration::from_secs(600);
}

struct CacheInner {
    client: redis::Client,
    /// Lazily established on first use. `get_or_try_init` does not cache
    /// failures, so a Redis outage at startup is retried on the next request
    /// rather than disabling the cache for the process lifetime.
    manager: OnceCell<ConnectionManager>,
}

impl std::fmt::Debug for CacheInner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CacheInner")
            .field("connected", &self.manager.initialized())
            .finish()
    }
}

/// Cache service wrapping a shared, self-healing Redis connection.
#[derive(Debug, Clone)]
pub struct CacheService {
    /// `None` when caching is disabled (unconfigured Redis, or tests).
    inner: Option<Arc<CacheInner>>,
}

impl CacheService {
    /// Create a cache service from a Redis URL and optional auth token.
    ///
    /// Fails only when the URL is malformed. A URL pointing at an unreachable
    /// server succeeds here and degrades at call time.
    pub fn new(redis_url: String, redis_token: String) -> Result<Self> {
        let normalized_url = normalize_redis_url(&redis_url, &redis_token)?;

        let client = redis::Client::open(normalized_url.as_str()).with_context(|| {
            format!(
                "Failed to open Redis client for host '{}'",
                redacted_host(&normalized_url)
            )
        })?;

        Ok(Self {
            inner: Some(Arc::new(CacheInner {
                client,
                manager: OnceCell::new(),
            })),
        })
    }

    /// Create a no-op cache service.
    ///
    /// Used for tests and whenever Redis is not configured.
    pub fn disabled() -> Self {
        Self { inner: None }
    }

    /// Create a no-op cache service for tests.
    pub fn for_tests() -> Self {
        Self::disabled()
    }

    /// Whether this service will actually talk to Redis.
    pub fn is_enabled(&self) -> bool {
        self.inner.is_some()
    }

    /// Borrow the shared connection, establishing it on first use.
    ///
    /// `ConnectionManager` is cheap to clone — clones share one multiplexed
    /// connection and one reconnect state machine.
    ///
    /// Every path here is bounded by a timeout. The cache sits behind the rate
    /// limiter, which runs in front of every `/api/v1` route, so an
    /// unreachable Redis must fail in milliseconds rather than retry. When the
    /// configured host stopped resolving (an Upstash free-tier database that
    /// had been deleted), the manager's default retry-with-backoff turned
    /// every API request into a hang — strictly worse than the cache simply
    /// being unavailable.
    async fn connection(&self) -> Result<ConnectionManager> {
        let inner = self
            .inner
            .as_ref()
            .context("Redis cache is disabled; no connection available")?;

        let manager = inner
            .manager
            .get_or_try_init(|| async {
                let config = redis::aio::ConnectionManagerConfig::new()
                    // One attempt, then give up and let the caller degrade.
                    .set_number_of_retries(0)
                    .set_connection_timeout(CONNECT_TIMEOUT)
                    .set_response_timeout(OP_TIMEOUT);

                tokio::time::timeout(
                    CONNECT_TIMEOUT,
                    ConnectionManager::new_with_config(inner.client.clone(), config),
                )
                .await
                .map_err(|_| {
                    anyhow::anyhow!("Redis connection attempt timed out after {CONNECT_TIMEOUT:?}")
                })?
                .map_err(anyhow::Error::from)
            })
            .await
            .context("Failed to establish Redis connection")?;

        Ok(manager.clone())
    }

    /// Run one cache operation under a hard deadline.
    ///
    /// Bounds the command itself, not just connection setup, so a Redis that
    /// accepts connections but stops answering cannot stall a request either.
    ///
    /// The budget covers connecting *and* the command, because the first call
    /// after startup does both. A budget shorter than `CONNECT_TIMEOUT` would
    /// abort a connection that was about to succeed.
    async fn with_deadline<T>(
        &self,
        what: &str,
        op: impl std::future::Future<Output = Result<T>>,
    ) -> Result<T> {
        let budget = CONNECT_TIMEOUT + OP_TIMEOUT;
        match tokio::time::timeout(budget, op).await {
            Ok(result) => result,
            Err(_) => Err(anyhow::anyhow!("Redis {what} timed out after {budget:?}")),
        }
    }

    /// Get a value from the cache, deserializing from JSON.
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        if self.inner.is_none() {
            return Ok(None);
        }

        self.with_deadline("GET", async {
            let mut conn = self.connection().await?;
            let raw: Option<String> = redis::cmd("GET")
                .arg(key)
                .query_async(&mut conn)
                .await
                .with_context(|| format!("Redis GET failed for key '{key}'"))?;

            match raw {
                Some(json) => {
                    let parsed = serde_json::from_str::<T>(&json)
                        .with_context(|| format!("Failed to deserialize cache key '{key}'"))?;
                    Ok(Some(parsed))
                }
                None => Ok(None),
            }
        })
        .await
    }

    /// Set a value in the cache with a TTL, serializing to JSON.
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Duration) -> Result<()> {
        if self.inner.is_none() {
            return Ok(());
        }

        let json = serde_json::to_string(value)
            .with_context(|| format!("Failed to serialize cache value for key '{key}'"))?;

        self.with_deadline("SETEX", async {
            let mut conn = self.connection().await?;
            redis::cmd("SETEX")
                .arg(key)
                .arg(ttl.as_secs())
                .arg(&json)
                .query_async::<()>(&mut conn)
                .await
                .with_context(|| format!("Redis SETEX failed for key '{key}'"))?;

            Ok(())
        })
        .await
    }

    /// Delete a key from the cache (for cache invalidation).
    pub async fn invalidate(&self, key: &str) -> Result<()> {
        if self.inner.is_none() {
            return Ok(());
        }

        self.with_deadline("DEL", async {
            let mut conn = self.connection().await?;
            redis::cmd("DEL")
                .arg(key)
                .query_async::<()>(&mut conn)
                .await
                .with_context(|| format!("Redis DEL failed for key '{key}'"))?;
            Ok(())
        })
        .await
    }

    /// Increment a counter key and apply TTL on first write.
    pub async fn increment_with_ttl(&self, key: &str, ttl: Duration) -> Result<u64> {
        if self.inner.is_none() {
            return Ok(0);
        }

        self.with_deadline("INCR", async {
            let mut conn = self.connection().await?;

            // Pipeline INCR + EXPIRE so the counter can never outlive its window
            // if the process dies between the two commands, and so each rate-limit
            // check costs one round trip instead of two.
            let (count,): (u64,) = redis::pipe()
                .atomic()
                .cmd("INCR")
                .arg(key)
                .cmd("EXPIRE")
                .arg(key)
                .arg(ttl.as_secs())
                .arg("NX")
                .ignore()
                .query_async(&mut conn)
                .await
                .with_context(|| format!("Redis INCR failed for key '{key}'"))?;

            Ok(count)
        })
        .await
    }

    /// Invalidate all article caches (e.g., after creating or editing an article).
    ///
    /// Uses `SCAN` rather than `KEYS` so it never blocks the server, but it is
    /// still O(keyspace) — call it on writes only, never on reads.
    pub async fn invalidate_articles(&self) -> Result<()> {
        if self.inner.is_none() {
            return Ok(());
        }

        self.with_deadline("SCAN+DEL", async {
            let mut conn = self.connection().await?;
            let mut cursor = 0_u64;

            loop {
                let (next_cursor, keys): (u64, Vec<String>) = redis::cmd("SCAN")
                    .arg(cursor)
                    .arg("MATCH")
                    .arg("articles:*")
                    .arg("COUNT")
                    .arg(100)
                    .query_async(&mut conn)
                    .await
                    .context("Redis SCAN failed while invalidating article cache")?;

                if !keys.is_empty() {
                    redis::cmd("DEL")
                        .arg(keys)
                        .query_async::<()>(&mut conn)
                        .await
                        .context("Redis DEL failed while invalidating article cache")?;
                }

                if next_cursor == 0 {
                    break;
                }
                cursor = next_cursor;
            }

            Ok(())
        })
        .await
    }
}

/// Normalize a Redis URL into a form `redis-rs` can connect with.
///
/// Handles the three shapes that show up in practice:
/// - Upstash REST URLs (`https://…`) are rewritten to `rediss://…:6379`.
/// - Upstash native URLs are forced onto TLS.
/// - A token is folded into the URL as credentials when the URL has none, so
///   that `ConnectionManager` re-authenticates on every reconnect.
fn normalize_redis_url(redis_url: &str, redis_token: &str) -> Result<String> {
    let mut normalized = redis_url.trim().to_string();
    let token = redis_token.trim();

    if normalized.starts_with("http://") || normalized.starts_with("https://") {
        let parsed = reqwest::Url::parse(&normalized)
            .with_context(|| format!("Invalid Redis URL format: '{}'", redacted_host(redis_url)))?;
        let host = parsed.host_str().context("Redis URL is missing a host")?;
        // Upstash REST URLs carry no port; their native endpoint is 6379.
        let port = parsed.port().unwrap_or(6379);
        let scheme = if parsed.scheme() == "https" {
            "rediss"
        } else {
            "redis"
        };
        normalized = format!("{scheme}://{host}:{port}");
    }

    if normalized.contains(".upstash.io") && normalized.starts_with("redis://") {
        // Upstash refuses plaintext connections.
        normalized = normalized.replacen("redis://", "rediss://", 1);
    }

    // Fold the token in as credentials. Carrying auth in the URL (rather than
    // issuing an AUTH command after connecting) is what makes reconnects work:
    // a manually issued AUTH is lost the moment the connection drops.
    if !token.is_empty() && !redis_url_has_credentials(&normalized) {
        let scheme_end = normalized
            .find("://")
            .context("Redis URL is missing a scheme separator")?
            + 3;
        normalized.insert_str(scheme_end, &format!("default:{token}@"));
    }

    Ok(normalized)
}

fn redis_url_has_credentials(redis_url: &str) -> bool {
    let Some(scheme_end) = redis_url.find("://") else {
        return false;
    };
    let authority_and_path = &redis_url[(scheme_end + 3)..];
    let authority = authority_and_path
        .split(['/', '?', '#'])
        .next()
        .unwrap_or(authority_and_path);
    authority.contains('@')
}

/// Extract just the host for logging, so credentials never reach the logs.
fn redacted_host(redis_url: &str) -> String {
    let after_scheme = redis_url
        .find("://")
        .map(|i| &redis_url[(i + 3)..])
        .unwrap_or(redis_url);
    let authority = after_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or(after_scheme);
    authority
        .rsplit('@')
        .next()
        .unwrap_or(authority)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_upstash_rest_url_to_native_tls() {
        let url = normalize_redis_url("https://example.upstash.io", "tok").unwrap();
        assert_eq!(url, "rediss://default:tok@example.upstash.io:6379");
    }

    #[test]
    fn forces_tls_for_upstash_plaintext_url() {
        let url = normalize_redis_url("redis://example.upstash.io:6379", "tok").unwrap();
        assert_eq!(url, "rediss://default:tok@example.upstash.io:6379");
    }

    #[test]
    fn preserves_existing_credentials() {
        let url =
            normalize_redis_url("rediss://default:already@example.upstash.io:6379", "tok").unwrap();
        assert_eq!(url, "rediss://default:already@example.upstash.io:6379");
    }

    #[test]
    fn leaves_passwordless_local_redis_untouched() {
        let url = normalize_redis_url("redis://localhost:6379", "").unwrap();
        assert_eq!(url, "redis://localhost:6379");
    }

    #[test]
    fn redacted_host_strips_credentials() {
        assert_eq!(
            redacted_host("rediss://default:supersecret@example.upstash.io:6379"),
            "example.upstash.io:6379"
        );
        assert_eq!(redacted_host("redis://localhost:6379"), "localhost:6379");
    }

    #[test]
    fn disabled_cache_is_a_no_op() {
        let cache = CacheService::disabled();
        assert!(!cache.is_enabled());
    }
}
