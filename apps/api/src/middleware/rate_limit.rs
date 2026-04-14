//! Per-user rate limiter using Redis sliding window.
//!
//! Uses Upstash Redis to track request counts per user (by IP or user ID).
//! Implements a sliding window counter with configurable limits.
//!
//! # Example
//!
//! ```rust
//! let rate_limiter = RateLimiter::new(redis_pool, 60, 30); // 30 requests per 60 seconds
//! ```

use axum::{
    Json,
    body::Body,
    extract::ConnectInfo,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use std::net::SocketAddr;

/// Rate limit configuration.
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Time window in seconds.
    pub window_seconds: u64,
    /// Maximum requests allowed per window.
    pub max_requests: u64,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            window_seconds: 60,
            max_requests: 30,
        }
    }
}

/// Error response when rate limit is exceeded.
#[derive(Serialize)]
struct RateLimitError {
    error: &'static str,
    message: String,
    retry_after_seconds: u64,
}

/// Rate limiting middleware function.
///
/// TODO: Connect to Redis for distributed rate limiting.
/// Currently uses a placeholder that always passes to unblock development.
///
/// In production, this will:
/// 1. Extract user identifier (IP or authenticated user ID)
/// 2. Increment a Redis counter with TTL = window_seconds
/// 3. Return 429 if counter exceeds max_requests
pub async fn rate_limit_middleware(
    connect_info: Option<ConnectInfo<SocketAddr>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    // Extract client identifier
    let _client_id = connect_info
        .map(|ci| ci.0.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // TODO: Implement Redis-based sliding window counter
    //
    // Pseudocode:
    // let key = format!("rate_limit:{client_id}");
    // let count: u64 = redis.incr(&key).await?;
    // if count == 1 {
    //     redis.expire(&key, config.window_seconds).await?;
    // }
    // if count > config.max_requests {
    //     return rate_limit_exceeded_response(config.window_seconds);
    // }

    // For now, pass through all requests
    next.run(request).await
}

/// Build a 429 Too Many Requests response.
#[allow(dead_code)]
fn rate_limit_exceeded_response(retry_after: u64) -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        [("Retry-After", retry_after.to_string())],
        Json(RateLimitError {
            error: "rate_limit_exceeded",
            message: format!("Too many requests. Please try again in {retry_after} seconds."),
            retry_after_seconds: retry_after,
        }),
    )
        .into_response()
}
