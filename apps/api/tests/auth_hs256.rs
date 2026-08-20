//! HS256 rejection lives in its own test binary.
//!
//! The assertion depends on process-wide environment state, and Cargo runs
//! tests within a binary concurrently — mutating the env here would race with
//! any other test that mints a token. A separate integration test file is a
//! separate process, which gives this the isolation it needs.

use std::sync::Arc;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use openforum_api::{
    build_app,
    config::{AppConfig, CloudinaryConfig},
    services::{articles::ArticlesService, cache::CacheService, cloudinary::CloudinaryService},
    state::AppState,
};
use serde::Serialize;
use tower::ServiceExt;

const TEST_JWT_SECRET: &str = "integration-test-secret";

#[derive(Serialize)]
struct Claims {
    sub: String,
    email: String,
    aud: String,
    exp: usize,
    user_role: String,
}

fn test_config() -> AppConfig {
    AppConfig {
        port: 3001,
        frontend_url: "http://localhost:3000".to_string(),
        supabase_url: "http://localhost:54321".to_string(),
        database_url: "postgres://user:password@localhost:5432/openforum_test".to_string(),
        cloudinary: CloudinaryConfig {
            cloud_name: "test".to_string(),
            api_key: "test".to_string(),
            api_secret: "test".to_string(),
            upload_folder: Some("tests".to_string()),
        },
        redis_url: None,
        redis_token: None,
        run_api_migrations: false,
    }
}

fn app() -> axum::Router {
    build_app(
        &test_config(),
        AppState {
            articles: ArticlesService::in_memory(),
            cloudinary: Arc::new(CloudinaryService::for_tests()),
            cache: Arc::new(CacheService::for_tests()),
        },
    )
}

/// Mint an HS256 token claiming the admin role for an arbitrary user id.
fn forged_admin_token() -> String {
    let claims = Claims {
        sub: "00000000-0000-0000-0000-0000000000ff".to_string(),
        email: "attacker@csvtu.ac.in".to_string(),
        aud: "authenticated".to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp() as usize,
        user_role: "admin".to_string(),
    };
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(TEST_JWT_SECRET.as_bytes()),
    )
    .expect("failed to encode token")
}

async fn status_for(token: &str) -> StatusCode {
    app()
        .oneshot(
            Request::builder()
                .uri("/api/v1/users/me")
                .method("GET")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response")
        .status()
}

/// `AXUM_JWT_SECRET` is the project's legacy Supabase JWT secret, and the
/// claims it validated carried both `sub` and the role. Accepting HS256
/// unconditionally therefore turned that single secret into full account
/// impersonation. Confirmed against a running API before the fix: a forged
/// admin token reached the editor-only moderation route (404 "not found",
/// i.e. authorized), while a forged `reader` token got 403 — proving the
/// forged role was trusted.
///
/// Both directions are asserted in one test because they mutate the same
/// process-wide variable; as separate tests they would race under Cargo's
/// default in-binary parallelism.
#[tokio::test]
async fn hs256_is_rejected_by_default_and_only_accepted_when_opted_in() {
    let token = forged_admin_token();

    unsafe {
        std::env::set_var("AXUM_JWT_SECRET", TEST_JWT_SECRET);
        std::env::remove_var("OPENFORUM_ALLOW_HS256_TOKENS");
    }
    assert_eq!(
        status_for(&token).await,
        StatusCode::UNAUTHORIZED,
        "a forged HS256 admin token must be refused when HS256 is not enabled"
    );

    unsafe {
        std::env::set_var("OPENFORUM_ALLOW_HS256_TOKENS", "true");
    }
    // Not 401: the token is accepted, and the handler then fails trying to
    // reach Supabase for a profile that does not exist.
    assert_ne!(
        status_for(&token).await,
        StatusCode::UNAUTHORIZED,
        "the documented test opt-in must keep working"
    );
}
