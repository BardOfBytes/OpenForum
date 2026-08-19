//! Live Redis integration tests for `CacheService`.
//!
//! These are ignored by default because they need a real Redis. Run with:
//!
//! ```sh
//! redis-server --port 6399 --daemonize yes --save '' --appendonly no
//! OPENFORUM_TEST_REDIS_URL=redis://127.0.0.1:6399 cargo test --test cache_redis -- --ignored
//! ```

use openforum_api::services::cache::{CacheService, ttl};
use std::time::Duration;

fn test_cache() -> CacheService {
    let url = std::env::var("OPENFORUM_TEST_REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6399".to_string());
    CacheService::new(url, String::new()).expect("cache service should construct")
}

async fn connected_clients(cache: &CacheService) -> i64 {
    // Ask Redis itself how many clients are attached, via a throwaway
    // connection that we subtract from the count.
    let url = std::env::var("OPENFORUM_TEST_REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6399".to_string());
    let client = redis::Client::open(url.as_str()).unwrap();
    let mut conn = client.get_multiplexed_async_connection().await.unwrap();
    let info: String = redis::cmd("INFO")
        .arg("clients")
        .query_async(&mut conn)
        .await
        .unwrap();

    let total = info
        .lines()
        .find_map(|line| line.strip_prefix("connected_clients:"))
        .and_then(|v| v.trim().parse::<i64>().ok())
        .unwrap_or(0);

    let _ = cache; // keep the cache alive across the measurement
    total - 1 // discount this measuring connection
}

/// The regression this guards: the previous implementation opened a fresh TCP
/// connection (and re-issued AUTH) on *every* cache operation. With the rate
/// limiter running in front of every route, that meant a new connection per
/// request — which is what exhausted Upstash's connection and command limits.
#[tokio::test]
#[ignore = "requires a live Redis"]
async fn many_operations_share_one_connection() {
    let cache = test_cache();

    // Warm the connection, then measure.
    cache.set("t:warm", &1u32, ttl::ARTICLE_LIST).await.unwrap();
    let baseline = connected_clients(&cache).await;

    for i in 0..50u32 {
        let key = format!("t:key:{i}");
        cache.set(&key, &i, ttl::ARTICLE_LIST).await.unwrap();
        let got: Option<u32> = cache.get(&key).await.unwrap();
        assert_eq!(got, Some(i));
    }

    let after = connected_clients(&cache).await;
    assert_eq!(
        after, baseline,
        "100 cache operations must not open new connections (baseline {baseline}, after {after})"
    );
}

/// A dropped connection must heal on its own. The old code issued AUTH manually
/// after connecting, so a reconnect silently lost authentication.
#[tokio::test]
#[ignore = "requires a live Redis"]
async fn survives_the_server_dropping_the_connection() {
    let cache = test_cache();

    cache
        .set("t:before", &7u32, ttl::ARTICLE_LIST)
        .await
        .unwrap();
    let before: Option<u32> = cache.get("t:before").await.unwrap();
    assert_eq!(before, Some(7));

    // Force every client connection to be dropped by the server.
    let url = std::env::var("OPENFORUM_TEST_REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6399".to_string());
    let client = redis::Client::open(url.as_str()).unwrap();
    let mut admin = client.get_multiplexed_async_connection().await.unwrap();
    let _: redis::RedisResult<()> = redis::cmd("CLIENT")
        .arg("KILL")
        .arg("TYPE")
        .arg("normal")
        .query_async(&mut admin)
        .await;

    // ConnectionManager reconnects transparently; give it a moment to notice.
    tokio::time::sleep(Duration::from_millis(250)).await;

    let mut recovered = false;
    for _ in 0..10 {
        if cache.set("t:after", &9u32, ttl::ARTICLE_LIST).await.is_ok() {
            let after: Option<u32> = cache.get("t:after").await.unwrap_or(None);
            if after == Some(9) {
                recovered = true;
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    assert!(
        recovered,
        "cache must recover after the connection is killed"
    );
}

/// A disabled cache must never error — it just misses.
#[tokio::test]
async fn disabled_cache_never_errors() {
    let cache = CacheService::disabled();
    assert!(!cache.is_enabled());

    assert!(cache.set("k", &1u32, ttl::ARTICLE_LIST).await.is_ok());
    let value: Option<u32> = cache.get("k").await.unwrap();
    assert_eq!(value, None);
    assert!(cache.invalidate("k").await.is_ok());
    assert!(cache.invalidate_articles().await.is_ok());
    assert_eq!(
        cache
            .increment_with_ttl("k", Duration::from_secs(60))
            .await
            .unwrap(),
        0
    );
}
