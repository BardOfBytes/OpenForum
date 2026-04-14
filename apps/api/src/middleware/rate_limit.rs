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
    extract::State,
    http::{HeaderMap, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use std::time::Duration;

use crate::state::AppState;

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
pub async fn rate_limit_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let config = RateLimitConfig::default();
    let request_path = request.uri().path().to_string();
    let client_id = forwarded_for_ip(request.headers())
        .unwrap_or_else(|| "unknown".to_string());
    let key = format!("rate_limit:{}:{}", client_id, request_path);

    let count = state
        .cache
        .increment_with_ttl(&key, Duration::from_secs(config.window_seconds))
        .await;

    match count {
        Ok(current_count) if current_count > config.max_requests => {
            tracing::warn!(
                client_id = %client_id,
                path = %request_path,
                current_count,
                max_requests = config.max_requests,
                "Rate limit exceeded"
            );
            return rate_limit_exceeded_response(config.window_seconds);
        }
        Ok(_) => {}
        Err(error) => {
            // Fail open when Redis is unavailable so the API remains reachable.
            tracing::warn!(
                error = %error,
                client_id = %client_id,
                path = %request_path,
                "Rate limiter unavailable; allowing request"
            );
        }
    }

    next.run(request).await
}

fn forwarded_for_ip(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
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
