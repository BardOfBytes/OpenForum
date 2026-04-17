//! Article routes — CRUD operations for the editorial feed.

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
};
use reqwest::Url;
use serde::Serialize;

use crate::middleware::auth::AuthUser;
use crate::models::article::{
    Article, ArticleListQuery, ArticlePreview, Author, Category, NewArticle,
};
use crate::state::AppState;

const YOUTUBE_EMBED_HOSTS: &[&str] = &[
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "youtube-nocookie.com",
    "m.youtube.com",
];

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
    let category = query.category.clone();

    let (data_result, total_result) = tokio::join!(
        state
            .articles
            .get_posts(per_page as usize, offset, category.as_deref()),
        state.articles.count_posts(category.as_deref())
    );

    let data = data_result.map_err(|error| {
        tracing::error!(error = %error, "Failed to list articles from storage backend");
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: "articles_unavailable",
                message: "Unable to load articles from storage backend".to_string(),
            }),
        )
    })?;

    let total = total_result.map_err(|error| {
        tracing::error!(error = %error, "Failed to count articles from storage backend");
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
        .articles
        .get_post_by_slug(&slug)
        .await
        .map_err(|error| {
            tracing::error!(
                error = %error,
                slug = %slug,
                "Failed to fetch article from storage backend"
            );
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
    if let Err(error) = state.articles.update_post_views(&slug).await {
        tracing::warn!(error = %error, slug = %slug, "Failed to increment article views");
    }

    Ok(Json(article))
}

async fn create_article(
    State(state): State<AppState>,
    user: AuthUser,
    Json(payload): Json<NewArticle>,
) -> Result<(StatusCode, Json<Article>), (StatusCode, Json<ErrorResponse>)> {
    let clean_body = sanitize_article_body(&payload.body);
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
        .articles
        .create_post(sanitized_payload, user.user_id)
        .await
        .map_err(|error| {
            tracing::error!(
                error = %error,
                user_id = %user.user_id,
                "Failed to create article in storage backend"
            );
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "article_create_failed",
                    message:
                        "Unable to create article in storage backend. Verify the configured backend is reachable and credentials are correct."
                            .to_string(),
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

fn sanitize_article_body(raw_html: &str) -> String {
    let mut cleaner = ammonia::Builder::default();
    cleaner.add_tags(std::iter::once("iframe"));
    cleaner.add_tag_attributes(
        "iframe",
        [
            "allow",
            "allowfullscreen",
            "frameborder",
            "height",
            "loading",
            "referrerpolicy",
            "src",
            "title",
            "width",
        ],
    );

    let cleaned = cleaner.clean(raw_html).to_string();
    remove_non_youtube_iframe_blocks(&cleaned)
}

fn remove_non_youtube_iframe_blocks(html: &str) -> String {
    let lowercase = html.to_ascii_lowercase();
    let mut output = String::with_capacity(html.len());
    let mut cursor = 0;

    while let Some(start_rel) = lowercase[cursor..].find("<iframe") {
        let start = cursor + start_rel;
        output.push_str(&html[cursor..start]);

        let Some(tag_end_rel) = lowercase[start..].find('>') else {
            cursor = html.len();
            break;
        };

        let tag_end = start + tag_end_rel + 1;
        let opening_tag = &html[start..tag_end];

        let block_end = if let Some(close_rel) = lowercase[tag_end..].find("</iframe>") {
            tag_end + close_rel + "</iframe>".len()
        } else {
            tag_end
        };

        let src = extract_attr_value(opening_tag, "src");
        if src
            .as_deref()
            .is_some_and(is_allowed_youtube_embed_src)
        {
            output.push_str(&html[start..block_end]);
        }

        cursor = block_end;
    }

    output.push_str(&html[cursor..]);
    output
}

fn extract_attr_value(tag_html: &str, attr_name: &str) -> Option<String> {
    let lowercase = tag_html.to_ascii_lowercase();

    let double_quoted = format!("{attr_name}=\"");
    if let Some(start) = lowercase.find(&double_quoted) {
        let value_start = start + double_quoted.len();
        let remainder = &tag_html[value_start..];
        let end = remainder.find('"')?;
        return Some(remainder[..end].to_string());
    }

    let single_quoted = format!("{attr_name}='");
    if let Some(start) = lowercase.find(&single_quoted) {
        let value_start = start + single_quoted.len();
        let remainder = &tag_html[value_start..];
        let end = remainder.find('\'')?;
        return Some(remainder[..end].to_string());
    }

    None
}

fn is_allowed_youtube_embed_src(src: &str) -> bool {
    let parsed = match Url::parse(src) {
        Ok(url) => url,
        Err(_) => return false,
    };

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return false;
    }

    let Some(host) = parsed.host_str() else {
        return false;
    };

    let normalized_host = host.to_ascii_lowercase();
    if !YOUTUBE_EMBED_HOSTS.contains(&normalized_host.as_str()) {
        return false;
    }

    parsed.path().starts_with("/embed/")
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
