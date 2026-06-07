//! Article routes — CRUD operations for the editorial feed.

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::middleware::auth::{AuthUser, OptionalAuthUser, UserRole};
use crate::models::article::{
    Article, ArticleListQuery, ArticlePreview, Author, AuthorSummary, Category, NewArticle,
};
use crate::services::articles::{ArticleSocialState, Comment, SocialState, UpdateArticle};
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

#[derive(Debug, Deserialize)]
pub struct CommentPayload {
    pub body: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CommentUpdatePayload {
    pub body: String,
}

fn can_manage_all_articles(user: &AuthUser) -> bool {
    matches!(user.role, UserRole::Editor | UserRole::Admin)
}

fn can_moderate_comments(user: &AuthUser) -> bool {
    matches!(user.role, UserRole::Editor | UserRole::Admin)
}

async fn list_articles(
    State(state): State<AppState>,
    Query(query): Query<ArticleListQuery>,
) -> Result<Json<PaginatedResponse<ArticlePreview>>, (StatusCode, Json<ErrorResponse>)> {
    let page = query.page();
    let per_page = query.per_page();
    let offset = ((page - 1) * per_page) as usize;
    let category = query.category.clone();
    let search = query.q.clone();
    let author = query.author;

    let (data_result, total_result) = tokio::join!(
        state.articles.get_posts(
            per_page as usize,
            offset,
            category.as_deref(),
            search.as_deref(),
            author,
        ),
        state
            .articles
            .count_posts(category.as_deref(), search.as_deref(), author)
    );

    let data = data_result.map_err(|error| {
        tracing::error!(error = %error, error_chain = ?error, "Failed to list articles from storage backend");
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: "articles_unavailable",
                message: "Unable to load articles from storage backend".to_string(),
            }),
        )
    })?;

    let total = total_result.map_err(|error| {
        tracing::error!(error = %error, error_chain = ?error, "Failed to count articles from storage backend");
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

async fn list_user_articles(
    State(state): State<AppState>,
    Path(author_id): Path<Uuid>,
    Query(query): Query<ArticleListQuery>,
) -> Result<Json<PaginatedResponse<ArticlePreview>>, (StatusCode, Json<ErrorResponse>)> {
    let page = query.page();
    let per_page = query.per_page();
    let offset = ((page - 1) * per_page) as usize;
    let category = query.category.clone();
    let search = query.q.clone();

    let (data_result, total_result) = tokio::join!(
        state.articles.get_posts(
            per_page as usize,
            offset,
            category.as_deref(),
            search.as_deref(),
            Some(author_id),
        ),
        state
            .articles
            .count_posts(category.as_deref(), search.as_deref(), Some(author_id))
    );

    let data = data_result.map_err(|error| {
        tracing::error!(error = %error, author_id = %author_id, "Failed to list user articles from storage backend");
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: "articles_unavailable",
                message: "Unable to load author articles from storage backend".to_string(),
            }),
        )
    })?;

    let total = total_result.map_err(|error| {
        tracing::error!(error = %error, author_id = %author_id, "Failed to count user articles from storage backend");
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: "articles_unavailable",
                message: "Unable to load author article metadata from storage backend".to_string(),
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

async fn list_authors(
    State(state): State<AppState>,
) -> Result<Json<Vec<AuthorSummary>>, (StatusCode, Json<ErrorResponse>)> {
    let authors = state.articles.list_authors(6).await.map_err(|error| {
        tracing::error!(error = %error, "Failed to list authors from storage backend");
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: "authors_unavailable",
                message: "Unable to load contributors from storage backend".to_string(),
            }),
        )
    })?;

    Ok(Json(authors))
}

async fn update_article(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    user: AuthUser,
    Json(payload): Json<UpdateArticle>,
) -> Result<Json<Article>, (StatusCode, Json<ErrorResponse>)> {
    let mut patch = payload;
    if let Some(body) = patch.body.as_deref() {
        patch.body = Some(sanitize_article_body(body));
    }

    // If the author clears the subtitle/deck, fall back to the excerpt so the
    // detail page never renders an empty deck. Prefer an excerpt sent in the
    // same patch; otherwise drop the blank subtitle so the existing one is kept.
    if let Some(subtitle) = patch.subtitle.as_deref()
        && subtitle.trim().is_empty() {
        patch.subtitle = patch
            .excerpt
            .as_deref()
            .map(str::trim)
            .filter(|excerpt| !excerpt.is_empty())
            .map(str::to_string);
    }

    let article = state
        .articles
        .update_post(&slug, patch, user.user_id, can_manage_all_articles(&user))
        .await
        .map_err(|error| {
            tracing::error!(
                error = %error,
                slug = %slug,
                user_id = %user.user_id,
                "Failed to update article"
            );
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "article_update_failed",
                    message: "Unable to update article right now".to_string(),
                }),
            )
        })?;

    article.map(Json).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "not_found",
                message: "Article not found or not editable by this user".to_string(),
            }),
        )
    })
}

async fn delete_article(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    user: AuthUser,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let deleted = state
        .articles
        .delete_post(&slug, user.user_id, can_manage_all_articles(&user))
        .await
        .map_err(|error| {
            tracing::error!(
                error = %error,
                slug = %slug,
                user_id = %user.user_id,
                "Failed to delete article"
            );
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "article_delete_failed",
                    message: "Unable to delete article right now".to_string(),
                }),
            )
        })?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "not_found",
                message: "Article not found or not deletable by this user".to_string(),
            }),
        ))
    }
}

async fn like_article(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    user: AuthUser,
) -> Result<Json<SocialState>, (StatusCode, Json<ErrorResponse>)> {
    social_result(
        state.articles.like_article(&slug, user.user_id).await,
        "like_failed",
        "Unable to like article right now",
    )
}

async fn unlike_article(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    user: AuthUser,
) -> Result<Json<SocialState>, (StatusCode, Json<ErrorResponse>)> {
    social_result(
        state.articles.unlike_article(&slug, user.user_id).await,
        "unlike_failed",
        "Unable to unlike article right now",
    )
}

async fn article_social_state(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    OptionalAuthUser(viewer): OptionalAuthUser,
) -> Result<Json<ArticleSocialState>, (StatusCode, Json<ErrorResponse>)> {
    let result = state
        .articles
        .article_social_state(&slug, viewer.map(|user| user.user_id))
        .await
        .map_err(|error| {
            tracing::error!(
                error = %error,
                slug = %slug,
                "Failed to resolve article social state"
            );
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "social_state_failed",
                    message: "Unable to load article social state right now".to_string(),
                }),
            )
        })?;

    result.map(Json).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "not_found",
                message: "Article not found".to_string(),
            }),
        )
    })
}

async fn bookmark_article(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    user: AuthUser,
) -> Result<Json<SocialState>, (StatusCode, Json<ErrorResponse>)> {
    social_result(
        state.articles.bookmark_article(&slug, user.user_id).await,
        "bookmark_failed",
        "Unable to bookmark article right now",
    )
}

async fn unbookmark_article(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    user: AuthUser,
) -> Result<Json<SocialState>, (StatusCode, Json<ErrorResponse>)> {
    social_result(
        state.articles.unbookmark_article(&slug, user.user_id).await,
        "unbookmark_failed",
        "Unable to remove bookmark right now",
    )
}

fn social_result(
    result: anyhow::Result<Option<SocialState>>,
    error: &'static str,
    message: &'static str,
) -> Result<Json<SocialState>, (StatusCode, Json<ErrorResponse>)> {
    result
        .map_err(|source| {
            tracing::error!(error = %source, "Article social action failed");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error,
                    message: message.to_string(),
                }),
            )
        })?
        .map(Json)
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "not_found",
                    message: "Article not found".to_string(),
                }),
            )
        })
}

async fn list_comments(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Vec<Comment>>, (StatusCode, Json<ErrorResponse>)> {
    let comments = state
        .articles
        .list_comments(&slug)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, slug = %slug, "Failed to list comments");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "comments_unavailable",
                    message: "Unable to load comments right now".to_string(),
                }),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "not_found",
                    message: "Article not found".to_string(),
                }),
            )
        })?;

    Ok(Json(comments))
}

async fn create_comment(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    user: AuthUser,
    Json(payload): Json<CommentPayload>,
) -> Result<(StatusCode, Json<Comment>), (StatusCode, Json<ErrorResponse>)> {
    let body = payload.body.trim().to_string();
    if body.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid_comment",
                message: "Comment body cannot be empty".to_string(),
            }),
        ));
    }

    let comment = state
        .articles
        .create_comment(&slug, user.user_id, body, payload.parent_id)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, slug = %slug, user_id = %user.user_id, "Failed to create comment");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "comment_create_failed",
                    message: "Unable to create comment right now".to_string(),
                }),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "not_found",
                    message: "Article not found".to_string(),
                }),
            )
        })?;

    Ok((StatusCode::CREATED, Json(comment)))
}

async fn update_comment(
    State(state): State<AppState>,
    Path(comment_id): Path<Uuid>,
    user: AuthUser,
    Json(payload): Json<CommentUpdatePayload>,
) -> Result<Json<Comment>, (StatusCode, Json<ErrorResponse>)> {
    let body = payload.body.trim().to_string();
    if body.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid_comment",
                message: "Comment body cannot be empty".to_string(),
            }),
        ));
    }

    let comment = state
        .articles
        .update_comment(comment_id, user.user_id, body)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, comment_id = %comment_id, user_id = %user.user_id, "Failed to update comment");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "comment_update_failed",
                    message: "Unable to update comment right now".to_string(),
                }),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "not_found",
                    message: "Comment not found or not editable by this user".to_string(),
                }),
            )
        })?;

    Ok(Json(comment))
}

async fn delete_comment(
    State(state): State<AppState>,
    Path(comment_id): Path<Uuid>,
    user: AuthUser,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let deleted = state
        .articles
        .delete_comment(comment_id, user.user_id)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, comment_id = %comment_id, user_id = %user.user_id, "Failed to delete comment");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "comment_delete_failed",
                    message: "Unable to delete comment right now".to_string(),
                }),
            )
        })?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "not_found",
                message: "Comment not found or not deletable by this user".to_string(),
            }),
        ))
    }
}

async fn hide_comment_as_moderator(
    State(state): State<AppState>,
    Path(comment_id): Path<Uuid>,
    user: AuthUser,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    if !can_moderate_comments(&user) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "forbidden",
                message: "Only editors and admins can moderate comments".to_string(),
            }),
        ));
    }

    let hidden = state
        .articles
        .hide_comment(comment_id, user.user_id)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, comment_id = %comment_id, user_id = %user.user_id, "Failed to hide comment");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "comment_hide_failed",
                    message: "Unable to hide comment right now".to_string(),
                }),
            )
        })?;

    if hidden {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "not_found",
                message: "Comment not found or already hidden".to_string(),
            }),
        ))
    }
}

async fn delete_comment_as_moderator(
    State(state): State<AppState>,
    Path(comment_id): Path<Uuid>,
    user: AuthUser,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    if !can_moderate_comments(&user) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "forbidden",
                message: "Only editors and admins can moderate comments".to_string(),
            }),
        ));
    }

    let deleted = state
        .articles
        .delete_comment_as_moderator(comment_id)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, comment_id = %comment_id, user_id = %user.user_id, "Failed to delete comment as moderator");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "comment_delete_failed",
                    message: "Unable to delete comment right now".to_string(),
                }),
            )
        })?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "not_found",
                message: "Comment not found".to_string(),
            }),
        ))
    }
}

async fn follow_user(
    State(state): State<AppState>,
    Path(following_id): Path<Uuid>,
    user: AuthUser,
) -> Result<Json<SocialState>, (StatusCode, Json<ErrorResponse>)> {
    state
        .articles
        .follow_user(user.user_id, following_id)
        .await
        .map(Json)
        .map_err(|error| {
            tracing::error!(error = %error, following_id = %following_id, user_id = %user.user_id, "Failed to follow user");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "follow_failed",
                    message: "Unable to follow user right now".to_string(),
                }),
            )
        })
}

async fn unfollow_user(
    State(state): State<AppState>,
    Path(following_id): Path<Uuid>,
    user: AuthUser,
) -> Result<Json<SocialState>, (StatusCode, Json<ErrorResponse>)> {
    state
        .articles
        .unfollow_user(user.user_id, following_id)
        .await
        .map(Json)
        .map_err(|error| {
            tracing::error!(error = %error, following_id = %following_id, user_id = %user.user_id, "Failed to unfollow user");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "unfollow_failed",
                    message: "Unable to unfollow user right now".to_string(),
                }),
            )
        })
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

    // The subtitle/deck is author-written. When left blank, fall back to the
    // article excerpt (the preview) so the detail page always shows a deck.
    let subtitle = {
        let trimmed = payload.subtitle.trim();
        if trimmed.is_empty() {
            payload.excerpt.trim().to_string()
        } else {
            trimmed.to_string()
        }
    };

    let sanitized_payload = NewArticle {
        title: payload.title,
        subtitle,
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
            username: None,
            headline: None,
            bio: None,
            articles_published: 0,
            total_views: 0,
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
    cleaner.add_tags([
        "iframe", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
    ]);
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
    cleaner.add_tag_attributes("th", ["colspan", "rowspan", "colwidth"]);
    cleaner.add_tag_attributes("td", ["colspan", "rowspan", "colwidth"]);
    cleaner.add_tag_attributes("col", ["width"]);
    cleaner.add_tag_attributes("span", ["class", "data-latex", "data-type"]);
    cleaner.add_tag_attributes("div", ["class", "data-latex", "data-type"]);
    cleaner.add_tag_attributes("code", ["class"]);
    cleaner.add_tag_attributes("pre", ["class"]);

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
        if src.as_deref().is_some_and(is_allowed_youtube_embed_src) {
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
        .route("/authors", get(list_authors))
        .route("/users/{author_id}/articles", get(list_user_articles))
        .route(
            "/articles/{slug}",
            get(get_article)
                .patch(update_article)
                .delete(delete_article),
        )
        .route(
            "/articles/{slug}/likes",
            post(like_article).delete(unlike_article),
        )
        .route("/articles/{slug}/social-state", get(article_social_state))
        .route(
            "/articles/{slug}/bookmarks",
            post(bookmark_article).delete(unbookmark_article),
        )
        .route(
            "/articles/{slug}/comments",
            get(list_comments).post(create_comment),
        )
        .route(
            "/comments/{comment_id}",
            axum::routing::put(update_comment).delete(delete_comment),
        )
        .route(
            "/comments/{comment_id}/moderation/hide",
            post(hide_comment_as_moderator),
        )
        .route(
            "/comments/{comment_id}/moderation",
            axum::routing::delete(delete_comment_as_moderator),
        )
        .route(
            "/users/{following_id}/follow",
            post(follow_user).delete(unfollow_user),
        )
}
