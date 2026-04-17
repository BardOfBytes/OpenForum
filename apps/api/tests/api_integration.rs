use std::sync::Arc;

use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use openforum_api::{
    build_app,
    config::{AppConfig, ArticlesProvider, CloudinaryConfig, StorageProvider},
    services::{
        articles::ArticlesService, cache::CacheService, cloudinary::CloudinaryService,
        drive::DriveService, sheets::SheetsService,
    },
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
        articles_provider: ArticlesProvider::Sheets,
        google_sheets_id: Some("spreadsheet-id".to_string()),
        google_service_account_json: Some("{}".to_string()),
        database_url: None,
        google_drive_folder_id: Some("drive-folder-id".to_string()),
        storage_provider: StorageProvider::Drive,
        cloudinary: None,
        redis_url: "redis://127.0.0.1:6379".to_string(),
        redis_token: "unused".to_string(),
    }
}

fn app_state_with_test_services() -> AppState {
    let cache = CacheService::for_tests();
    AppState {
        articles: ArticlesService::Sheets(Arc::new(SheetsService::for_tests(vec![]))),
        drive: Some(Arc::new(DriveService::for_tests())),
        cloudinary: None,
        storage_provider: StorageProvider::Drive,
        cache: Arc::new(cache),
    }
}

fn app_state_with_cloudinary_uploads() -> AppState {
    let cache = CacheService::for_tests();
    AppState {
        articles: ArticlesService::Sheets(Arc::new(SheetsService::for_tests(vec![]))),
        drive: None,
        cloudinary: Some(Arc::new(CloudinaryService::for_tests())),
        storage_provider: StorageProvider::Cloudinary,
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
        articles: ArticlesService::Sheets(Arc::new(sheets)),
        drive: Some(Arc::new(DriveService::for_tests())),
        cloudinary: None,
        storage_provider: StorageProvider::Drive,
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
        articles: ArticlesService::Sheets(Arc::new(SheetsService::for_tests(vec![]))),
        drive: Some(Arc::new(drive)),
        cloudinary: None,
        storage_provider: StorageProvider::Drive,
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
        .clone()
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
    assert_eq!(body["status"], "Published");
    assert!(body["id"].as_str().is_some());
    assert_eq!(body["tags"], json!(["integration", "rust"]));

    let list_response = app
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
    let list_body = json_body(list_response).await;
    let slugs: Vec<String> = list_body["data"]
        .as_array()
        .expect("paginated list data array")
        .iter()
        .filter_map(|item| item.get("slug").and_then(Value::as_str))
        .map(ToString::to_string)
        .collect();

    assert!(
        slugs.iter().any(|slug| slug == "integration-test-article"),
        "newly created article should be visible in latest article list"
    );
}

#[tokio::test]
async fn article_create_keeps_youtube_iframe_and_drops_unsafe_html() {
    let app = test_app(app_state_with_test_services());
    let token = test_auth_token("writer@csvtu.ac.in");

    let payload = json!({
      "title": "Embedded Media Article",
      "body": "<p>Video intro</p><iframe src=\"https://www.youtube.com/embed/dQw4w9WgXcQ\" title=\"YouTube video\" allowfullscreen></iframe><iframe src=\"https://evil.example.com/embed/tracker\"></iframe><script>alert('xss')</script>",
      "excerpt": "Video intro",
      "content_gdoc_id": null,
      "cover_image_url": null,
      "category_name": "Tech & AI",
      "tags": ["video"]
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
    let stored_html = body["body"].as_str().expect("body html string");

    assert!(
        stored_html.contains("youtube.com/embed/dQw4w9WgXcQ"),
        "expected YouTube iframe src to be preserved"
    );
    assert!(
        !stored_html.contains("evil.example.com"),
        "expected non-YouTube iframe to be removed"
    );
    assert!(
        !stored_html.to_ascii_lowercase().contains("<script"),
        "expected script tags to be removed"
    );
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

#[tokio::test]
async fn cloudinary_upload_happy_path_returns_201() {
    // Ensure Cloudinary config types stay usable from the public API.
    let _ = CloudinaryConfig {
        cloud_name: "test".to_string(),
        api_key: "test".to_string(),
        api_secret: "test".to_string(),
        upload_folder: Some("tests".to_string()),
    };

    let app = test_app(app_state_with_cloudinary_uploads());
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

    assert_eq!(response.status(), StatusCode::CREATED);
    let json = json_body(response).await;
    assert!(json["file_id"].as_str().is_some());
    assert!(json["public_url"].as_str().is_some());
}
