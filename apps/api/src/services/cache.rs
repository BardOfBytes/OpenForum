//! Redis cache-aside helpers.

use anyhow::{Context, Result, bail};
use redis::aio::MultiplexedConnection;
use serde::{Serialize, de::DeserializeOwned};
use std::time::Duration;

/// Cache key prefixes to avoid collisions.
pub mod keys {
    /// Cache key for the article feed list.
    pub fn article_list(page: u32, per_page: u32, category: Option<&str>) -> String {
        match category {
            Some(cat) => format!("articles:list:{}:{}:{}", cat, page, per_page),
            None => format!("articles:list:all:{}:{}", page, per_page),
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
    /// Single article cache: 5 minutes.
    pub const ARTICLE_DETAIL: Duration = Duration::from_secs(300);
    /// User profile cache: 10 minutes.
    pub const USER_PROFILE: Duration = Duration::from_secs(600);
}

/// Cache service wrapping a Redis connection.
#[derive(Debug, Clone)]
pub struct CacheService {
    client: Option<redis::Client>,
    redis_token: String,
    disabled: bool,
}

impl CacheService {
    /// Create a new CacheService.
    pub fn new(redis_url: String, redis_token: String) -> Result<Self> {
        let client = redis::Client::open(redis_url.as_str())
            .with_context(|| format!("Failed to open Redis client for URL '{redis_url}'"))?;
        Ok(Self {
            client: Some(client),
            redis_token,
            disabled: false,
        })
    }

    /// Create a no-op cache service for tests.
    pub fn for_tests() -> Self {
        Self {
            client: None,
            redis_token: String::new(),
            disabled: true,
        }
    }

    async fn connection(&self) -> Result<MultiplexedConnection> {
        if self.disabled {
            bail!("CacheService is disabled for tests");
        }

        let client = self
            .client
            .as_ref()
            .context("Redis client is not initialized")?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .context("Failed to connect to Redis")?;

        // Upstash uses AUTH token; ignore AUTH-on-no-password for local Redis.
        let auth_result: redis::RedisResult<()> = redis::cmd("AUTH")
            .arg(&self.redis_token)
            .query_async(&mut conn)
            .await;

        if let Err(error) = auth_result {
            let message = error.to_string();
            if !message.contains("no password is set")
                && !message.contains("AUTH called without any password configured")
            {
                return Err(error).context("Redis AUTH failed");
            }
        }

        Ok(conn)
    }

    /// Get a value from the cache, deserializing from JSON.
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        if self.disabled {
            return Ok(None);
        }

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
    }

    /// Set a value in the cache with a TTL, serializing to JSON.
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Duration) -> Result<()> {
        if self.disabled {
            return Ok(());
        }

        let json = serde_json::to_string(value)
            .with_context(|| format!("Failed to serialize cache value for key '{key}'"))?;

        let mut conn = self.connection().await?;
        redis::cmd("SETEX")
            .arg(key)
            .arg(ttl.as_secs())
            .arg(&json)
            .query_async::<()>(&mut conn)
            .await
            .with_context(|| format!("Redis SETEX failed for key '{key}'"))?;

        Ok(())
    }

    /// Delete a key from the cache (for cache invalidation).
    pub async fn invalidate(&self, key: &str) -> Result<()> {
        if self.disabled {
            return Ok(());
        }

        let mut conn = self.connection().await?;
        redis::cmd("DEL")
            .arg(key)
            .query_async::<()>(&mut conn)
            .await
            .with_context(|| format!("Redis DEL failed for key '{key}'"))?;
        Ok(())
    }

    /// Increment a counter key and apply TTL on first write.
    pub async fn increment_with_ttl(&self, key: &str, ttl: Duration) -> Result<u64> {
        if self.disabled {
            return Ok(0);
        }

        let mut conn = self.connection().await?;
        let count: u64 = redis::cmd("INCR")
            .arg(key)
            .query_async(&mut conn)
            .await
            .with_context(|| format!("Redis INCR failed for key '{key}'"))?;

        if count == 1 {
            redis::cmd("EXPIRE")
                .arg(key)
                .arg(ttl.as_secs())
                .query_async::<()>(&mut conn)
                .await
                .with_context(|| format!("Redis EXPIRE failed for key '{key}'"))?;
        }

        Ok(count)
    }

    /// Invalidate all article caches (e.g., after creating or editing an article).
    pub async fn invalidate_articles(&self) -> Result<()> {
        if self.disabled {
            return Ok(());
        }

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
    }
}
