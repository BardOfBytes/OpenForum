//! Article domain models.
//!
//! These structs represent articles at different stages:
//! - `NewArticle`: incoming payload from the frontend editor
//! - `Article`: full article record (stored in Google Sheets / Postgres)
//! - `ArticlePreview`: compact shape for feed cards (excludes body)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Category metadata attached to every article.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub name: String,
    /// Hex color code for the category badge (e.g. "#d4613c").
    pub color: String,
}

/// Author information embedded in article responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Author {
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
}

/// Full article record — used for detail pages.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub excerpt: String,
    pub content_gdoc_id: Option<String>, // Replaces direct body content in Sheet
    pub author_id: Uuid,
    pub category: String, // Kept as string in Sheet
    pub tags: Vec<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub views: u32,

    // Virtual fields joined at runtime to satisfy frontend/APIs
    pub body: String, // Populated later if fetching from gdoc
    pub cover_image_url: Option<String>,
    pub category_detail: Option<Category>,
    pub author_detail: Option<Author>,
    pub read_time_minutes: u16,
}

/// Compact article shape for feed/grid — no body content.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArticlePreview {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub excerpt: String,
    pub content_gdoc_id: Option<String>,
    pub tags: Vec<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub views: u32,

    // Virtual fields joined at runtime
    pub cover_image_url: Option<String>,
    pub preview_image_url: Option<String>,
    pub category: Category,
    pub author: Author,
    pub read_time_minutes: u16,
}

/// Incoming payload for creating a new article.
#[derive(Debug, Deserialize)]
pub struct NewArticle {
    pub title: String,
    pub body: String,
    pub excerpt: String,
    pub content_gdoc_id: Option<String>,
    pub cover_image_url: Option<String>,
    pub category_name: String,
    pub tags: Vec<String>,
}

/// Query parameters for listing articles.
#[derive(Debug, Deserialize)]
pub struct ArticleListQuery {
    /// Filter by category slug (optional).
    pub category: Option<String>,
    /// Page number (1-indexed, default: 1).
    pub page: Option<u32>,
    /// Items per page (default: 12, max: 50).
    pub per_page: Option<u32>,
}

impl ArticleListQuery {
    pub fn page(&self) -> u32 {
        self.page.unwrap_or(1).max(1)
    }

    pub fn per_page(&self) -> u32 {
        self.per_page.unwrap_or(12).min(50)
    }
}

impl From<&Article> for ArticlePreview {
    fn from(article: &Article) -> Self {
        let preview_image_url = article
            .cover_image_url
            .clone()
            .or_else(|| youtube_thumbnail_from_html(&article.body));

        Self {
            id: article.id,
            title: article.title.clone(),
            slug: article.slug.clone(),
            excerpt: article.excerpt.clone(),
            content_gdoc_id: article.content_gdoc_id.clone(),
            tags: article.tags.clone(),
            status: article.status.clone(),
            created_at: article.created_at,
            updated_at: article.updated_at,
            views: article.views,

            cover_image_url: article.cover_image_url.clone(),
            preview_image_url,
            category: article.category_detail.clone().unwrap_or(Category {
                name: article.category.clone(),
                color: "#d4613c".to_string(), // Default fallback
            }),
            author: article.author_detail.clone().unwrap_or(Author {
                id: article.author_id,
                name: "Unknown Author".to_string(),
                avatar_url: None,
            }),
            read_time_minutes: article.read_time_minutes,
        }
    }
}

pub fn youtube_thumbnail_from_html(html: &str) -> Option<String> {
    let src = extract_first_iframe_src(html)?;
    let video_id = youtube_video_id_from_url(&src)?;
    Some(format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"))
}

fn extract_first_iframe_src(html: &str) -> Option<String> {
    let lowercase = html.to_ascii_lowercase();
    let iframe_start = lowercase.find("<iframe")?;

    let segment = &html[iframe_start..];
    let segment_lowercase = &lowercase[iframe_start..];

    let double_quoted = "src=\"";
    if let Some(position) = segment_lowercase.find(double_quoted) {
        let value_start = position + double_quoted.len();
        let remainder = &segment[value_start..];
        let value_end = remainder.find('"')?;
        let src = remainder[..value_end].trim();
        if !src.is_empty() {
            return Some(src.to_string());
        }
    }

    let single_quoted = "src='";
    if let Some(position) = segment_lowercase.find(single_quoted) {
        let value_start = position + single_quoted.len();
        let remainder = &segment[value_start..];
        let value_end = remainder.find('\'')?;
        let src = remainder[..value_end].trim();
        if !src.is_empty() {
            return Some(src.to_string());
        }
    }

    None
}

fn youtube_video_id_from_url(url: &str) -> Option<String> {
    let lowered = url.to_ascii_lowercase();

    for marker in [
        "youtube.com/embed/",
        "youtube-nocookie.com/embed/",
        "m.youtube.com/embed/",
        "youtu.be/",
    ] {
        if let Some(start_index) = lowered.find(marker) {
            let value_start = start_index + marker.len();
            let remainder = &url[value_start..];
            let video_id = remainder
                .split(['?', '&', '#', '/'])
                .next()
                .unwrap_or("")
                .trim();

            if !video_id.is_empty() {
                return Some(video_id.to_string());
            }
        }
    }

    if let Some(query_start) = lowered.find('?') {
        let query = &url[(query_start + 1)..];
        for pair in query.split('&') {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next().unwrap_or("").trim();
            let value = parts.next().unwrap_or("").trim();

            if key == "v" && !value.is_empty() {
                let video_id = value.split(['#', '/']).next().unwrap_or("").trim();
                if !video_id.is_empty() {
                    return Some(video_id.to_string());
                }
            }
        }
    }

    None
}
