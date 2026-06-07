use std::sync::Arc;

use axum::{
    body::{Body, to_bytes},
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
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

const TEST_JWT_SECRET: &str = "integration-test-secret";

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
        redis_url: "redis://127.0.0.1:6379".to_string(),
        redis_token: "unused".to_string(),
        run_api_migrations: false,
    }
}

fn app_state_with_test_services() -> AppState {
    let cache = CacheService::for_tests();
    AppState {
        articles: ArticlesService::in_memory(),
        cloudinary: Arc::new(CloudinaryService::for_tests()),
        cache: Arc::new(cache),
    }
}

fn app_state_with_cloudinary_uploads() -> AppState {
    let cache = CacheService::for_tests();
    AppState {
        articles: ArticlesService::in_memory(),
        cloudinary: Arc::new(CloudinaryService::for_tests()),
        cache: Arc::new(cache),
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
    test_auth_token_with_user_id(email, "00000000-0000-0000-0000-000000000123")
}

fn test_auth_token_with_user_id(email: &str, user_id: &str) -> String {
    test_auth_token_with_user_id_and_role(email, user_id, "student")
}

fn test_auth_token_with_user_id_and_role(email: &str, user_id: &str, role: &str) -> String {
    // Required for auth extractor HS256 validation path in tests.
    unsafe {
        std::env::set_var("AXUM_JWT_SECRET", TEST_JWT_SECRET);
    }

    let claims = TestJwtClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        aud: "authenticated".to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp() as usize,
        user_role: role.to_string(),
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(TEST_JWT_SECRET.as_bytes()),
    )
    .expect("failed to create test JWT")
}

fn test_auth_token_with_role(email: &str, role: &str) -> String {
    test_auth_token_with_user_id_and_role(email, "00000000-0000-0000-0000-000000000123", role)
}

async fn create_test_article(app: axum::Router, token: &str, title: &str) -> Value {
    let payload = json!({
      "title": title,
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
    json_body(response).await
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

    let first_article = list_body["data"]
        .as_array()
        .expect("paginated list data array")
        .first()
        .expect("created article preview should be returned");
    assert_eq!(first_article["featured"], false);
    assert_eq!(first_article["views"], 0);
    assert_eq!(first_article["author"]["headline"], Value::Null);
    assert_eq!(first_article["author"]["articles_published"], 0);
}

#[tokio::test]
async fn article_list_supports_author_and_search_filters() {
    let app = test_app(app_state_with_test_services());
    let writer_id = "00000000-0000-0000-0000-000000000456";
    let token = test_auth_token_with_user_id("writer@csvtu.ac.in", writer_id);

    create_test_article(app.clone(), &token, "Filtered Author Story").await;

    let author_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/users/{writer_id}/articles"))
                .method("GET")
                .body(Body::empty())
                .expect("author articles request"),
        )
        .await
        .expect("author articles response");
    assert_eq!(author_response.status(), StatusCode::OK);
    let author_body = json_body(author_response).await;
    assert_eq!(author_body["total"], 1);
    assert_eq!(author_body["data"][0]["slug"], "filtered-author-story");

    let search_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles?author={writer_id}&q=Filtered"))
                .method("GET")
                .body(Body::empty())
                .expect("filtered list request"),
        )
        .await
        .expect("filtered list response");
    assert_eq!(search_response.status(), StatusCode::OK);
    let search_body = json_body(search_response).await;
    assert_eq!(search_body["total"], 1);
    assert_eq!(search_body["data"][0]["slug"], "filtered-author-story");
}

#[tokio::test]
async fn authors_endpoint_lists_published_contributors() {
    let app = test_app(app_state_with_test_services());
    let writer_id = "00000000-0000-0000-0000-000000000789";
    let token = test_auth_token_with_user_id("contributor@csvtu.ac.in", writer_id);

    create_test_article(app.clone(), &token, "Contributor Directory Story").await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/authors")
                .method("GET")
                .body(Body::empty())
                .expect("authors request"),
        )
        .await
        .expect("authors response");

    assert_eq!(response.status(), StatusCode::OK);
    let body = json_body(response).await;
    let authors = body.as_array().expect("authors should be an array");
    assert_eq!(authors.len(), 1);
    assert_eq!(authors[0]["id"], writer_id);
    assert_eq!(authors[0]["articles_published"], 1);
    assert_eq!(authors[0]["total_views"], 0);
}

#[tokio::test]
async fn article_subtitle_is_stored_and_falls_back_to_excerpt_when_blank() {
    let app = test_app(app_state_with_test_services());
    let token = test_auth_token("writer@csvtu.ac.in");

    // Explicit subtitle is preserved.
    let with_subtitle = json!({
      "title": "Article With Deck",
      "subtitle": "An authored standfirst that hooks the reader.",
      "body": "<p>Body.</p>",
      "excerpt": "Short preview summary.",
      "content_gdoc_id": null,
      "cover_image_url": null,
      "category_name": "Campus News",
      "tags": []
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/articles")
                .method("POST")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(with_subtitle.to_string()))
                .expect("create request"),
        )
        .await
        .expect("create response");

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = json_body(response).await;
    assert_eq!(
        body["subtitle"],
        "An authored standfirst that hooks the reader."
    );

    // Blank subtitle falls back to the excerpt (the article preview).
    let blank_subtitle = json!({
      "title": "Article Without Deck",
      "subtitle": "   ",
      "body": "<p>Body.</p>",
      "excerpt": "Short preview summary.",
      "content_gdoc_id": null,
      "cover_image_url": null,
      "category_name": "Campus News",
      "tags": []
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/articles")
                .method("POST")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(blank_subtitle.to_string()))
                .expect("create request"),
        )
        .await
        .expect("create response");

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = json_body(response).await;
    assert_eq!(body["subtitle"], "Short preview summary.");
}

#[tokio::test]
async fn article_update_and_delete_authenticated_flow() {
    let app = test_app(app_state_with_test_services());
    let token = test_auth_token("writer@csvtu.ac.in");
    let created = create_test_article(app.clone(), &token, "Editable Article").await;
    let slug = created["slug"].as_str().expect("created slug");

    let patch = json!({
      "title": "Edited Article",
      "body": "<p>Edited body</p><script>alert('xss')</script>",
      "excerpt": "Edited excerpt",
      "category_name": "Editorials",
      "tags": ["edited"],
      "status": "Published"
    });

    let update_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}"))
                .method("PATCH")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(patch.to_string()))
                .expect("update request"),
        )
        .await
        .expect("update response");

    assert_eq!(update_response.status(), StatusCode::OK);
    let updated = json_body(update_response).await;
    assert_eq!(updated["title"], "Edited Article");
    assert_eq!(updated["excerpt"], "Edited excerpt");
    assert_eq!(updated["tags"], json!(["edited"]));
    assert!(
        !updated["body"]
            .as_str()
            .expect("updated body")
            .to_ascii_lowercase()
            .contains("<script")
    );

    let delete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}"))
                .method("DELETE")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .expect("delete request"),
        )
        .await
        .expect("delete response");

    assert_eq!(delete_response.status(), StatusCode::NO_CONTENT);

    let detail_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}"))
                .method("GET")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");

    assert_eq!(detail_response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn article_social_endpoints_work_for_authenticated_users() {
    let app = test_app(app_state_with_test_services());
    let token = test_auth_token("writer@csvtu.ac.in");
    let created = create_test_article(app.clone(), &token, "Social Article").await;
    let slug = created["slug"].as_str().expect("created slug");

    let like_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/likes"))
                .method("POST")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .expect("like request"),
        )
        .await
        .expect("like response");
    assert_eq!(like_response.status(), StatusCode::OK);
    let like_body = json_body(like_response).await;
    assert_eq!(like_body["active"], true);
    assert_eq!(like_body["count"], 1);

    let bookmark_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/bookmarks"))
                .method("POST")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .expect("bookmark request"),
        )
        .await
        .expect("bookmark response");
    assert_eq!(bookmark_response.status(), StatusCode::OK);
    let bookmark_body = json_body(bookmark_response).await;
    assert_eq!(bookmark_body["active"], true);
    assert_eq!(bookmark_body["count"], 1);

    let comment_payload = json!({ "body": "First comment", "parent_id": null });
    let comment_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/comments"))
                .method("POST")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(comment_payload.to_string()))
                .expect("comment request"),
        )
        .await
        .expect("comment response");
    assert_eq!(comment_response.status(), StatusCode::CREATED);
    let comment = json_body(comment_response).await;
    let comment_id = comment["id"].as_str().expect("comment id");
    assert_eq!(comment["body"], "First comment");

    let update_comment_payload = json!({ "body": "Edited comment" });
    let update_comment_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/comments/{comment_id}"))
                .method("PUT")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(update_comment_payload.to_string()))
                .expect("update comment request"),
        )
        .await
        .expect("update comment response");
    assert_eq!(update_comment_response.status(), StatusCode::OK);
    let updated_comment = json_body(update_comment_response).await;
    assert_eq!(updated_comment["body"], "Edited comment");

    let list_comments_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/comments"))
                .method("GET")
                .body(Body::empty())
                .expect("list comments request"),
        )
        .await
        .expect("list comments response");
    assert_eq!(list_comments_response.status(), StatusCode::OK);
    let comments = json_body(list_comments_response).await;
    assert_eq!(comments.as_array().expect("comments array").len(), 1);

    let following_id = Uuid::new_v4();
    let follow_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/users/{following_id}/follow"))
                .method("POST")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .expect("follow request"),
        )
        .await
        .expect("follow response");
    assert_eq!(follow_response.status(), StatusCode::OK);
    let follow_body = json_body(follow_response).await;
    assert_eq!(follow_body["active"], true);
    assert_eq!(follow_body["count"], 1);

    let delete_comment_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/comments/{comment_id}"))
                .method("DELETE")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .expect("delete comment request"),
        )
        .await
        .expect("delete comment response");
    assert_eq!(delete_comment_response.status(), StatusCode::NO_CONTENT);

    let unlike_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/likes"))
                .method("DELETE")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .expect("unlike request"),
        )
        .await
        .expect("unlike response");
    assert_eq!(unlike_response.status(), StatusCode::OK);
    let unlike_body = json_body(unlike_response).await;
    assert_eq!(unlike_body["active"], false);
    assert_eq!(unlike_body["count"], 0);
}

#[tokio::test]
async fn comment_moderation_requires_editor_or_admin_and_removes_public_comment() {
    let app = test_app(app_state_with_test_services());
    let author_token =
        test_auth_token_with_user_id("author@csvtu.ac.in", "00000000-0000-0000-0000-000000000111");
    let other_token =
        test_auth_token_with_user_id("other@csvtu.ac.in", "00000000-0000-0000-0000-000000000222");
    let editor_token = test_auth_token_with_user_id_and_role(
        "editor@csvtu.ac.in",
        "00000000-0000-0000-0000-000000000333",
        "editor",
    );

    let created = create_test_article(app.clone(), &author_token, "Moderated Comments").await;
    let slug = created["slug"].as_str().expect("created slug");
    let comment_payload = json!({ "body": "Needs moderation", "parent_id": null });
    let comment_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/comments"))
                .method("POST")
                .header("authorization", format!("Bearer {other_token}"))
                .header("content-type", "application/json")
                .body(Body::from(comment_payload.to_string()))
                .expect("comment request"),
        )
        .await
        .expect("comment response");
    assert_eq!(comment_response.status(), StatusCode::CREATED);
    let comment = json_body(comment_response).await;
    let comment_id = comment["id"].as_str().expect("comment id");

    let author_delete_other_comment_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/comments/{comment_id}"))
                .method("DELETE")
                .header("authorization", format!("Bearer {author_token}"))
                .body(Body::empty())
                .expect("author delete other comment request"),
        )
        .await
        .expect("author delete other comment response");
    assert_eq!(
        author_delete_other_comment_response.status(),
        StatusCode::NOT_FOUND
    );

    let writer_hide_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/comments/{comment_id}/moderation/hide"))
                .method("POST")
                .header("authorization", format!("Bearer {author_token}"))
                .body(Body::empty())
                .expect("writer hide request"),
        )
        .await
        .expect("writer hide response");
    assert_eq!(writer_hide_response.status(), StatusCode::FORBIDDEN);

    let editor_hide_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/comments/{comment_id}/moderation/hide"))
                .method("POST")
                .header("authorization", format!("Bearer {editor_token}"))
                .body(Body::empty())
                .expect("editor hide request"),
        )
        .await
        .expect("editor hide response");
    assert_eq!(editor_hide_response.status(), StatusCode::NO_CONTENT);

    let list_comments_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/comments"))
                .method("GET")
                .body(Body::empty())
                .expect("list comments request"),
        )
        .await
        .expect("list comments response");
    assert_eq!(list_comments_response.status(), StatusCode::OK);
    let comments = json_body(list_comments_response).await;
    assert_eq!(comments.as_array().expect("comments array").len(), 0);
}

#[tokio::test]
async fn admin_can_delete_any_comment_without_affecting_author_delete_flow() {
    let app = test_app(app_state_with_test_services());
    let author_token =
        test_auth_token_with_user_id("author@csvtu.ac.in", "00000000-0000-0000-0000-000000000111");
    let commenter_token = test_auth_token_with_user_id(
        "commenter@csvtu.ac.in",
        "00000000-0000-0000-0000-000000000222",
    );
    let admin_token = test_auth_token_with_role("admin@csvtu.ac.in", "admin");

    let created = create_test_article(app.clone(), &author_token, "Admin Moderated Comments").await;
    let slug = created["slug"].as_str().expect("created slug");
    let comment_payload = json!({ "body": "Remove me", "parent_id": null });
    let comment_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/comments"))
                .method("POST")
                .header("authorization", format!("Bearer {commenter_token}"))
                .header("content-type", "application/json")
                .body(Body::from(comment_payload.to_string()))
                .expect("comment request"),
        )
        .await
        .expect("comment response");
    assert_eq!(comment_response.status(), StatusCode::CREATED);
    let comment = json_body(comment_response).await;
    let comment_id = comment["id"].as_str().expect("comment id");

    let admin_delete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/comments/{comment_id}/moderation"))
                .method("DELETE")
                .header("authorization", format!("Bearer {admin_token}"))
                .body(Body::empty())
                .expect("admin delete request"),
        )
        .await
        .expect("admin delete response");
    assert_eq!(admin_delete_response.status(), StatusCode::NO_CONTENT);

    let list_comments_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/articles/{slug}/comments"))
                .method("GET")
                .body(Body::empty())
                .expect("list comments request"),
        )
        .await
        .expect("list comments response");
    assert_eq!(list_comments_response.status(), StatusCode::OK);
    let comments = json_body(list_comments_response).await;
    assert_eq!(comments.as_array().expect("comments array").len(), 0);
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
async fn article_create_keeps_table_markup_for_rendering() {
    let app = test_app(app_state_with_test_services());
    let token = test_auth_token("writer@csvtu.ac.in");

    let payload = json!({
      "title": "Table Formatting Article",
      "body": "<p>Scores</p><table><thead><tr><th>Subject</th><th>Score</th></tr></thead><tbody><tr><td>Math</td><td>98</td></tr></tbody></table>",
      "excerpt": "Scores",
      "content_gdoc_id": null,
      "cover_image_url": null,
      "category_name": "Editorials",
      "tags": ["table"]
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
        stored_html.contains("<table>"),
        "expected table tag to be preserved"
    );
    assert!(
        stored_html.contains("<thead>"),
        "expected thead tag to be preserved"
    );
    assert!(
        stored_html.contains("<tbody>"),
        "expected tbody tag to be preserved"
    );
    assert!(
        stored_html.contains("<th>Subject</th>"),
        "expected header cell to be preserved"
    );
    assert!(
        stored_html.contains("<td>98</td>"),
        "expected data cell to be preserved"
    );
}

#[tokio::test]
async fn article_create_keeps_math_nodes_and_code_language_class() {
    let app = test_app(app_state_with_test_services());
    let token = test_auth_token("writer@csvtu.ac.in");

    let payload = json!({
      "title": "Math And Code Article",
      "body": "<p>Equation</p><span data-type=\"inline-math\" data-latex=\"E=mc^2\"></span><div data-type=\"block-math\" data-latex=\"\\\\sum_{i=1}^{n} x_i\"></div><pre><code class=\"language-rust\">fn main() { println!(\"hi\"); }</code></pre>",
      "excerpt": "Equation",
      "content_gdoc_id": null,
      "cover_image_url": null,
      "category_name": "Tech & AI",
      "tags": ["math", "code"]
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
        stored_html.contains("data-type=\"inline-math\""),
        "expected inline math marker to be preserved"
    );
    assert!(
        stored_html.contains("data-type=\"block-math\""),
        "expected block math marker to be preserved"
    );
    assert!(
        stored_html.contains("data-latex=\"E=mc^2\""),
        "expected inline math latex to be preserved"
    );
    assert!(
        stored_html.contains("language-rust"),
        "expected code language class to be preserved"
    );
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
    let public_url = json["public_url"].as_str().expect("public_url");
    assert!(public_url.contains("/image/upload/f_auto/q_auto/"));
}
