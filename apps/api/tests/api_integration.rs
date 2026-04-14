use std::sync::Arc;

use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use openforum_api::{
    build_app,
    config::AppConfig,
    services::{cache::CacheService, drive::DriveService, sheets::SheetsService},
    state::AppState,
};
use serde::Serialize;
use serde_json::{Value, json};
use tower::ServiceExt;

const TEST_JWT_SECRET: &str = "integration-test-secret";

fn test_config() -> AppConfig {
    AppConfig {
        port: 3001,
        frontend_url: "http://localhost:3000".to_string(),
        supabase_url: "http://localhost:54321".to_string(),
        google_sheets_id: "spreadsheet-id".to_string(),
        google_service_account_json: "{}".to_string(),
        google_drive_folder_id: "drive-folder-id".to_string(),
        redis_url: "redis://127.0.0.1:6379".to_string(),
        redis_token: "unused".to_string(),
    }
}

fn app_state_with_test_services() -> AppState {
    let cache = CacheService::for_tests();
    AppState {
        sheets: Arc::new(SheetsService::for_tests(vec![])),
        drive: Arc::new(DriveService::for_tests()),
        cache: Arc::new(cache),
    }
}

fn app_state_with_failing_sheets() -> AppState {
    let service_account_json = r#"{
      "client_email":"invalid@example.com",
      "private_key":"not-a-real-rsa-key"
    }"#;

    let sheets = SheetsService::new(
        "sheet-id".to_string(),
        service_account_json.to_string(),
        CacheService::for_tests(),
    )
    .expect("failing sheets constructor should still parse service account json");

    AppState {
        sheets: Arc::new(sheets),
        drive: Arc::new(DriveService::for_tests()),
        cache: Arc::new(CacheService::for_tests()),
    }
}

fn app_state_with_failing_drive() -> AppState {
    let service_account_json = r#"{
      "client_email":"invalid@example.com",
      "private_key":"not-a-real-rsa-key"
    }"#;

    let drive = DriveService::new("drive-folder".to_string(), service_account_json.to_string())
        .expect("failing drive constructor should still parse service account json");

    AppState {
        sheets: Arc::new(SheetsService::for_tests(vec![])),
        drive: Arc::new(drive),
        cache: Arc::new(CacheService::for_tests()),
    }
}

fn test_app(state: AppState) -> axum::Router {
    build_app(&test_config(), state)
}

#[derive(Serialize)]
struct TestJwtClaims {
    sub: String,
    email: String,
    aud: String,
    exp: usize,
    user_role: String,
}

fn test_auth_token(email: &str) -> String {
    // Required for auth extractor HS256 validation path in tests.
    unsafe {
        std::env::set_var("AXUM_JWT_SECRET", TEST_JWT_SECRET);
    }

    let claims = TestJwtClaims {
        sub: "00000000-0000-0000-0000-000000000123".to_string(),
        email: email.to_string(),
        aud: "authenticated".to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp() as usize,
        user_role: "student".to_string(),
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(TEST_JWT_SECRET.as_bytes()),
    )
    .expect("failed to create test JWT")
}

async fn json_body(response: axum::response::Response) -> Value {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body read failed");
    serde_json::from_slice(&body).expect("response body should be JSON")
}

#[tokio::test]
async fn route_existence_and_statuses_are_stable() {
    let app = test_app(app_state_with_test_services());

    let health_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/health")
                .method("GET")
                .body(Body::empty())
                .expect("health request"),
        )
        .await
        .expect("health response");
    assert_eq!(health_response.status(), StatusCode::OK);

    let list_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/articles")
                .method("GET")
                .body(Body::empty())
                .expect("list request"),
        )
        .await
        .expect("list response");
    assert_eq!(list_response.status(), StatusCode::OK);

    let detail_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/articles/missing-article")
                .method("GET")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(detail_response.status(), StatusCode::NOT_FOUND);

    let upload_response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/upload")
                .method("POST")
                .header("content-type", "multipart/form-data; boundary=----test")
                .body(Body::from("------test--\r\n"))
                .expect("upload request"),
        )
        .await
        .expect("upload response");
    assert_eq!(upload_response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn article_create_authenticated_flow_returns_201_with_slug() {
    let app = test_app(app_state_with_test_services());
    let token = test_auth_token("writer@csvtu.ac.in");

    let payload = json!({
      "title": "Integration Test Article",
      "body": "<p>Hello from integration test body.</p>",
      "excerpt": "Hello from integration test body.",
      "content_gdoc_id": null,
      "cover_image_url": null,
      "category_name": "Campus News",
      "tags": ["integration", "rust"]
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/articles")
                .method("POST")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .expect("create request"),
        )
        .await
        .expect("create response");

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = json_body(response).await;

    assert_eq!(body["title"], "Integration Test Article");
    assert_eq!(body["slug"], "integration-test-article");
    assert_eq!(body["status"], "Draft");
    assert!(body["id"].as_str().is_some());
    assert_eq!(body["tags"], json!(["integration", "rust"]));
}

#[tokio::test]
async fn sheets_failure_returns_structured_non_200_error() {
    let app = test_app(app_state_with_failing_sheets());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/articles")
                .method("GET")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    let body = json_body(response).await;
    assert_eq!(body["error"], "articles_unavailable");
    assert!(body["message"].as_str().is_some());
}

#[tokio::test]
async fn drive_failure_returns_structured_non_200_error() {
    let app = test_app(app_state_with_failing_drive());
    let token = test_auth_token("writer@csvtu.ac.in");

    let boundary = "----openforum-test-boundary";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"photo.png\"\r\nContent-Type: image/png\r\n\r\nnot-a-real-image\r\n--{boundary}--\r\n"
    );

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/upload")
                .method("POST")
                .header("authorization", format!("Bearer {token}"))
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(body))
                .expect("upload request"),
        )
        .await
        .expect("upload response");

    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    let json = json_body(response).await;
    assert_eq!(json["error"], "upload_failed");
    assert!(json["message"].as_str().is_some());
}
