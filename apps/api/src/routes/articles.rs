//! Article routes — CRUD operations for the editorial feed.

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
};
use serde::Serialize;

use crate::middleware::auth::AuthUser;
use crate::models::article::{
    Article, ArticleListQuery, ArticlePreview, Author, Category, NewArticle,
};
use crate::state::AppState;

#[derive(Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub page: u32,
    pub per_page: u32,
    pub total: u32,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: &'static str,
    pub message: String,
}

async fn list_articles(
    State(state): State<AppState>,
    Query(query): Query<ArticleListQuery>,
) -> Result<Json<PaginatedResponse<ArticlePreview>>, (StatusCode, Json<ErrorResponse>)> {
    let page = query.page();
    let per_page = query.per_page();
    let offset = ((page - 1) * per_page) as usize;

    let data = state
        .sheets
        .get_posts(per_page as usize, offset, query.category.as_deref())
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "Failed to list articles from Sheets");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "articles_unavailable",
                    message: "Unable to load articles from storage backend".to_string(),
                }),
            )
        })?;

    let total = state
        .sheets
        .count_posts(query.category.as_deref())
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "Failed to count articles from Sheets");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "articles_unavailable",
                    message: "Unable to load article metadata from storage backend".to_string(),
                }),
            )
        })?;

    Ok(Json(PaginatedResponse {
        data,
        page,
        per_page,
        total,
    }))
}

async fn get_article(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Article>, (StatusCode, Json<ErrorResponse>)> {
    let article = state
        .sheets
        .get_post_by_slug(&slug)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, slug = %slug, "Failed to fetch article from Sheets");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "article_unavailable",
                    message: "Unable to load article from storage backend".to_string(),
                }),
            )
        })?;

    let article = match article {
        Some(article) => article,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "not_found",
                    message: "Article not found".to_string(),
                }),
            ));
        }
    };

    // Views tracking is best-effort and should not break reads.
    if let Err(error) = state.sheets.update_post_views(&slug).await {
        tracing::warn!(error = %error, slug = %slug, "Failed to increment article views");
    }

    Ok(Json(article))
}

async fn create_article(
    State(state): State<AppState>,
    user: AuthUser,
    Json(payload): Json<NewArticle>,
) -> Result<(StatusCode, Json<Article>), (StatusCode, Json<ErrorResponse>)> {
    let clean_body = ammonia::clean(&payload.body);
    let read_time = (clean_body.split_whitespace().count() / 200).max(1) as u16;
    let category_name = payload.category_name.clone();
    let author_name = user
        .email
        .split('@')
        .next()
        .unwrap_or("Anonymous")
        .to_string();

    let sanitized_payload = NewArticle {
        title: payload.title,
        body: clean_body,
        excerpt: payload.excerpt,
        content_gdoc_id: payload.content_gdoc_id,
        cover_image_url: payload.cover_image_url,
        category_name,
        tags: payload.tags,
    };

    let mut article = state
        .sheets
        .create_post(sanitized_payload, user.user_id)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, user_id = %user.user_id, "Failed to create article in Sheets");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "article_create_failed",
                    message: "Unable to create article in storage backend".to_string(),
                }),
            )
        })?;

    article.read_time_minutes = read_time;
    if article.category_detail.is_none() {
        article.category_detail = Some(Category {
            name: article.category.clone(),
            color: category_color_hex(&article.category).to_string(),
        });
    }
    if article.author_detail.is_none() {
        article.author_detail = Some(Author {
            id: article.author_id,
            name: author_name,
            avatar_url: None,
        });
    }

    tracing::info!(
        article_id = %article.id,
        slug = %article.slug,
        author = %user.email,
        "New article created"
    );

    Ok((StatusCode::CREATED, Json(article)))
}

fn category_color_hex(category_name: &str) -> &str {
    match category_name.to_lowercase().as_str() {
        "campus news" => "#d4613c",
        "tech & ai" => "#3d7cc9",
        "editorials" => "#8b5e3c",
        "internship diaries" => "#3d8b5f",
        "career paths" => "#9b59a6",
        "investigations" => "#c4392b",
        "culture & events" => "#c4852c",
        _ => "#d4613c",
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/articles", get(list_articles).post(create_article))
        .route("/articles/{slug}", get(get_article))
}
