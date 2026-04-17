//! Google Sheets read/write abstraction.

use crate::models::article::{Article, ArticlePreview, Author, Category, NewArticle};
use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use uuid::Uuid;

/// Google API token endpoint.
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
/// Google Sheets API scope.
const SCOPE_SPREADSHEETS: &str = "https://www.googleapis.com/auth/spreadsheets";
const POSTS_SHEET_TITLE: &str = "posts";
const POSTS_HEADER_RANGE: &str = "posts!A1:N1";
const POSTS_LIST_RANGE: &str = "posts!A2:N";
const POSTS_LOOKUP_RANGE: &str = "posts!A:N";
const POSTS_APPEND_RANGE: &str = "posts!A:A";
const POSTS_HEADER_ROW: [&str; 14] = [
    "id",
    "slug",
    "title",
    "excerpt",
    "content_gdoc_id",
    "author_id",
    "category",
    "tags",
    "status",
    "created_at",
    "updated_at",
    "views",
    "cover_image_url",
    "body",
];

#[derive(Deserialize, Debug)]
struct ServiceAccountJson {
    client_email: String,
    private_key: String,
}

#[derive(Serialize)]
struct GoogleTokenClaims {
    iss: String,
    scope: String,
    aud: String,
    exp: usize,
    iat: usize,
}

#[derive(Deserialize, Debug)]
struct GoogleTokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Clone)]
struct CachedToken {
    token: String,
    expires_at: Instant,
}

/// Google Sheets API client.
#[derive(Clone)]
pub struct SheetsService {
    spreadsheet_id: String,
    client: reqwest::Client,
    service_email: String,
    private_key: String,
    cached_token: Arc<RwLock<Option<CachedToken>>>,
    schema_initialized: Arc<RwLock<bool>>,
    pub cache: crate::services::cache::CacheService,
    mock_posts: Option<Arc<RwLock<Vec<Article>>>>,
}

#[derive(Deserialize)]
struct SheetValueRange {
    #[serde(default)]
    values: Vec<Vec<String>>,
}

#[derive(Serialize)]
struct SheetValueUpdate {
    range: String,
    #[serde(rename = "majorDimension")]
    major_dimension: String,
    values: Vec<Vec<String>>,
}

#[derive(Deserialize)]
struct SpreadsheetMetadataResponse {
    #[serde(default)]
    sheets: Vec<SpreadsheetSheetEntry>,
}

#[derive(Deserialize)]
struct SpreadsheetSheetEntry {
    #[serde(default)]
    properties: SpreadsheetSheetProperties,
}

#[derive(Deserialize, Default)]
struct SpreadsheetSheetProperties {
    #[serde(default)]
    title: String,
}

impl SheetsService {
    /// Create a new SheetsService.
    pub fn new(
        spreadsheet_id: String,
        service_account_json: String,
        cache: crate::services::cache::CacheService,
    ) -> Result<Self> {
        let sa: ServiceAccountJson = serde_json::from_str(&service_account_json)
            .context("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            spreadsheet_id,
            client,
            service_email: sa.client_email,
            private_key: sa.private_key,
            cached_token: Arc::new(RwLock::new(None)),
            schema_initialized: Arc::new(RwLock::new(false)),
            cache,
            mock_posts: None,
        })
    }

    pub fn for_tests(seed_posts: Vec<Article>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(1))
            .build()
            .expect("Failed to create test HTTP client");
        let cache = crate::services::cache::CacheService::for_tests();

        Self {
            spreadsheet_id: "__TEST__".to_string(),
            client,
            service_email: "test@example.com".to_string(),
            private_key: "test".to_string(),
            cached_token: Arc::new(RwLock::new(None)),
            schema_initialized: Arc::new(RwLock::new(true)),
            cache,
            mock_posts: Some(Arc::new(RwLock::new(seed_posts))),
        }
    }

    async fn get_access_token(&self) -> Result<String> {
        {
            let guard = self.cached_token.read().await;
            if let Some(ref cached) = *guard
                && cached.expires_at > Instant::now() + Duration::from_secs(60)
            {
                return Ok(cached.token.clone());
            }
        }

        let mut guard = self.cached_token.write().await;
        if let Some(ref cached) = *guard
            && cached.expires_at > Instant::now() + Duration::from_secs(60)
        {
            return Ok(cached.token.clone());
        }

        let now = Utc::now().timestamp() as usize;
        let claims = GoogleTokenClaims {
            iss: self.service_email.clone(),
            scope: SCOPE_SPREADSHEETS.to_string(),
            aud: TOKEN_URL.to_string(),
            iat: now,
            exp: now + 3500,
        };

        let encoding_key = EncodingKey::from_rsa_pem(self.private_key.as_bytes())
            .context("Invalid service account private key format")?;
        let jwt = encode(&Header::new(Algorithm::RS256), &claims, &encoding_key)
            .context("Failed to sign JWT for Google Auth")?;

        let params = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &jwt),
        ];

        let response: GoogleTokenResponse = self
            .client
            .post(TOKEN_URL)
            .form(&params)
            .send()
            .await
            .context("Network error requesting Google access token")?
            .error_for_status()
            .context("Google OAuth API returned an error")?
            .json()
            .await
            .context("Failed to parse Google OAuth JSON")?;

        let expires_at = Instant::now() + Duration::from_secs(response.expires_in);
        *guard = Some(CachedToken {
            token: response.access_token.clone(),
            expires_at,
        });

        Ok(response.access_token)
    }

    async fn fetch_sheet_titles(&self, token: &str) -> Result<Vec<String>> {
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}?fields=sheets(properties(title))",
            self.spreadsheet_id
        );

        let response = self
            .client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("Google Sheets metadata request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Google Sheets metadata returned HTTP {status}: {error_body}");
        }

        let metadata: SpreadsheetMetadataResponse = response
            .json()
            .await
            .context("Failed to decode Google Sheets metadata response")?;

        Ok(metadata
            .sheets
            .into_iter()
            .filter_map(|sheet| {
                let title = sheet.properties.title.trim().to_string();
                if title.is_empty() { None } else { Some(title) }
            })
            .collect())
    }

    async fn create_posts_sheet(&self, token: &str) -> Result<()> {
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}:batchUpdate",
            self.spreadsheet_id
        );

        let body = serde_json::json!({
            "requests": [
                {
                    "addSheet": {
                        "properties": {
                            "title": POSTS_SHEET_TITLE
                        }
                    }
                }
            ]
        });

        let response = self
            .client
            .post(&url)
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .context("Google Sheets add-sheet request failed")?;

        if response.status().is_success() {
            return Ok(());
        }

        let status = response.status();
        let error_body = response
            .text()
            .await
            .unwrap_or_else(|_| "<unavailable>".to_string());

        if status == reqwest::StatusCode::BAD_REQUEST
            && error_body.to_ascii_lowercase().contains("already exists")
        {
            return Ok(());
        }

        bail!("Google Sheets add-sheet returned HTTP {status}: {error_body}");
    }

    async fn ensure_posts_header_row(&self, token: &str) -> Result<()> {
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}",
            self.spreadsheet_id, POSTS_HEADER_RANGE
        );

        let response = self
            .client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("Google Sheets header read request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Google Sheets header read returned HTTP {status}: {error_body}");
        }

        let range: SheetValueRange = response
            .json()
            .await
            .context("Failed to decode Google Sheets header read response")?;

        let header_needs_update = match range.values.first() {
            Some(row) => {
                if row.iter().all(|cell| cell.trim().is_empty()) {
                    true
                } else {
                    POSTS_HEADER_ROW
                        .iter()
                        .enumerate()
                        .any(|(index, expected)| {
                            row.get(index)
                                .map(|actual| !expected.eq_ignore_ascii_case(actual.trim()))
                                .unwrap_or(true)
                        })
                }
            }
            None => true,
        };

        if !header_needs_update {
            return Ok(());
        }

        let update_url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}?valueInputOption=RAW",
            self.spreadsheet_id, POSTS_HEADER_RANGE
        );

        let body = SheetValueUpdate {
            range: POSTS_HEADER_RANGE.to_string(),
            major_dimension: "ROWS".to_string(),
            values: vec![
                POSTS_HEADER_ROW
                    .iter()
                    .map(|value| value.to_string())
                    .collect(),
            ],
        };

        let response = self
            .client
            .put(&update_url)
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .context("Google Sheets header write request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Google Sheets header write returned HTTP {status}: {error_body}");
        }

        Ok(())
    }

    async fn ensure_posts_sheet_schema(&self) -> Result<()> {
        if self.mock_posts.is_some() {
            return Ok(());
        }

        {
            let guard = self.schema_initialized.read().await;
            if *guard {
                return Ok(());
            }
        }

        let mut guard = self.schema_initialized.write().await;
        if *guard {
            return Ok(());
        }

        let token = self.get_access_token().await?;
        let sheet_titles = self.fetch_sheet_titles(&token).await?;
        if !sheet_titles
            .iter()
            .any(|title| title.eq_ignore_ascii_case(POSTS_SHEET_TITLE))
        {
            self.create_posts_sheet(&token).await?;
        }

        self.ensure_posts_header_row(&token).await?;
        *guard = true;
        Ok(())
    }

    fn row_to_article_preview(row: &[String]) -> Option<ArticlePreview> {
        if row.len() < 12 {
            return None;
        }

        let id = Uuid::parse_str(&row[0]).ok()?;
        let author_id = Uuid::parse_str(&row[5]).unwrap_or_default();
        let created_at = DateTime::parse_from_rfc3339(&row[9])
            .ok()?
            .with_timezone(&Utc);
        let updated_at = DateTime::parse_from_rfc3339(&row[10])
            .ok()?
            .with_timezone(&Utc);
        let views = row[11].parse::<u32>().unwrap_or(0);
        let tags: Vec<String> = row[7]
            .split(',')
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim().to_string())
            .collect();
        let cover_image_url = row
            .get(12)
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(ToString::to_string);
        let body = row.get(13).map(|value| value.trim()).unwrap_or("");
        let word_source = if body.is_empty() { row[3].trim() } else { body };
        let read_time_minutes = (word_source.split_whitespace().count() / 200).max(1) as u16;

        let category_name = row[6].clone();
        let category_color = match category_name.to_lowercase().as_str() {
            "campus news" => "#d4613c",
            "tech & ai" => "#3d7cc9",
            "editorials" => "#8b5e3c",
            "internship diaries" => "#3d8b5f",
            "career paths" => "#9b59a6",
            "culture & events" => "#c4852c",
            "investigations" => "#c4392b",
            _ => "#d4613c",
        };

        Some(ArticlePreview {
            id,
            slug: row[1].clone(),
            title: row[2].clone(),
            excerpt: row[3].clone(),
            content_gdoc_id: if row[4].is_empty() {
                None
            } else {
                Some(row[4].clone())
            },
            tags,
            status: row[8].clone(),
            created_at,
            updated_at,
            views,
            cover_image_url,
            category: Category {
                name: category_name,
                color: category_color.to_string(),
            },
            author: Author {
                id: author_id,
                name: "Unknown Author".to_string(),
                avatar_url: None,
            },
            read_time_minutes,
        })
    }

    fn category_slug(category_name: &str) -> String {
        slug::slugify(category_name)
    }

    fn is_feed_visible_status(status: &str) -> bool {
        status.eq_ignore_ascii_case("Published") || status.eq_ignore_ascii_case("Draft")
    }

    async fn read_range(&self, range: &str) -> Result<Vec<Vec<String>>> {
        if range.to_ascii_lowercase().starts_with("posts!") {
            self.ensure_posts_sheet_schema().await?;
        }

        let token = self.get_access_token().await?;
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}",
            self.spreadsheet_id, range
        );

        let response = self
            .client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("Google Sheets read request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Google Sheets read returned HTTP {status}: {error_body}");
        }

        let response: SheetValueRange = response
            .json()
            .await
            .context("Failed to decode Google Sheets read response")?;

        Ok(response.values)
    }

    pub async fn get_posts(
        &self,
        limit: usize,
        offset: usize,
        category: Option<&str>,
    ) -> Result<Vec<ArticlePreview>> {
        let normalized_category = category.map(|value| value.trim().to_ascii_lowercase());

        if let Some(mock_posts) = &self.mock_posts {
            let posts = mock_posts.read().await.clone();
            let mut previews: Vec<ArticlePreview> = posts
                .iter()
                .map(ArticlePreview::from)
                .filter(|item| Self::is_feed_visible_status(&item.status))
                .collect();
            previews.sort_by_key(|item| std::cmp::Reverse(item.created_at));
            let filtered = if let Some(category_slug) = normalized_category.as_deref() {
                previews
                    .into_iter()
                    .filter(|item| Self::category_slug(&item.category.name) == category_slug)
                    .collect::<Vec<_>>()
            } else {
                previews
            };
            return Ok(filtered.into_iter().skip(offset).take(limit).collect());
        }

        let cache_key =
            crate::services::cache::keys::article_list(offset as u32, limit as u32, category);
        if let Ok(Some(cached)) = self.cache.get::<Vec<ArticlePreview>>(&cache_key).await {
            return Ok(cached);
        }

        let rows = self.read_range(POSTS_LIST_RANGE).await?;
        let mut previews: Vec<ArticlePreview> = rows
            .iter()
            .filter_map(|row| Self::row_to_article_preview(row))
            .filter(|item| Self::is_feed_visible_status(&item.status))
            .collect();

        if let Some(category_slug) = normalized_category.as_deref() {
            previews.retain(|item| Self::category_slug(&item.category.name) == category_slug);
        }

        previews.sort_by_key(|item| std::cmp::Reverse(item.created_at));
        let result: Vec<ArticlePreview> = previews.into_iter().skip(offset).take(limit).collect();

        let _ = self
            .cache
            .set(
                &cache_key,
                &result,
                crate::services::cache::ttl::ARTICLE_LIST,
            )
            .await;
        Ok(result)
    }

    pub async fn count_posts(&self, category: Option<&str>) -> Result<u32> {
        let normalized_category = category.map(|value| value.trim().to_ascii_lowercase());

        let cache_key = crate::services::cache::keys::article_count(category);
        if let Ok(Some(cached)) = self.cache.get::<u32>(&cache_key).await {
            return Ok(cached);
        }

        if let Some(mock_posts) = &self.mock_posts {
            let posts = mock_posts.read().await.clone();
            let previews: Vec<ArticlePreview> = posts
                .iter()
                .map(ArticlePreview::from)
                .filter(|item| Self::is_feed_visible_status(&item.status))
                .collect();
            let filtered = if let Some(category_slug) = normalized_category.as_deref() {
                previews
                    .into_iter()
                    .filter(|item| Self::category_slug(&item.category.name) == category_slug)
                    .collect::<Vec<_>>()
            } else {
                previews
            };

            let total = filtered.len() as u32;
            let _ = self
                .cache
                .set(
                    &cache_key,
                    &total,
                    crate::services::cache::ttl::ARTICLE_COUNT,
                )
                .await;

            return Ok(total);
        }

        let rows = self.read_range(POSTS_LIST_RANGE).await?;
        let mut previews: Vec<ArticlePreview> = rows
            .iter()
            .filter_map(|row| Self::row_to_article_preview(row))
            .filter(|item| Self::is_feed_visible_status(&item.status))
            .collect();

        if let Some(category_slug) = normalized_category.as_deref() {
            previews.retain(|item| Self::category_slug(&item.category.name) == category_slug);
        }

        let total = previews.len() as u32;
        let _ = self
            .cache
            .set(
                &cache_key,
                &total,
                crate::services::cache::ttl::ARTICLE_COUNT,
            )
            .await;

        Ok(total)
    }

    pub async fn get_post_by_slug(&self, slug: &str) -> Result<Option<Article>> {
        if let Some(mock_posts) = &self.mock_posts {
            let posts = mock_posts.read().await;
            return Ok(posts.iter().find(|item| item.slug == slug).cloned());
        }

        let cache_key = crate::services::cache::keys::article_by_slug(slug);
        if let Ok(Some(cached)) = self.cache.get::<Article>(&cache_key).await {
            return Ok(Some(cached));
        }

        let rows = self.read_range(POSTS_LIST_RANGE).await?;
        for row in rows {
            if row.len() >= 2
                && row[1] == slug
                && let Some(preview) = Self::row_to_article_preview(&row)
            {
                let resolved_body = row
                    .get(13)
                    .map(String::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToString::to_string)
                    .unwrap_or_else(|| format!("<p>{}</p>", preview.excerpt));

                let article = Article {
                    id: preview.id,
                    slug: preview.slug,
                    title: preview.title,
                    excerpt: preview.excerpt,
                    content_gdoc_id: preview.content_gdoc_id,
                    author_id: preview.author.id,
                    category: preview.category.name.clone(),
                    tags: preview.tags,
                    status: preview.status,
                    created_at: preview.created_at,
                    updated_at: preview.updated_at,
                    views: preview.views,
                    body: resolved_body,
                    cover_image_url: preview.cover_image_url,
                    category_detail: Some(preview.category),
                    author_detail: Some(preview.author),
                    read_time_minutes: preview.read_time_minutes,
                };
                let _ = self
                    .cache
                    .set(
                        &cache_key,
                        &article,
                        crate::services::cache::ttl::ARTICLE_DETAIL,
                    )
                    .await;
                return Ok(Some(article));
            }
        }

        Ok(None)
    }

    pub async fn create_post(&self, new_post: NewArticle, author_id: Uuid) -> Result<Article> {
        let id = Uuid::new_v4();
        let slug = slug::slugify(&new_post.title);
        let now = Utc::now();
        let status = "Published".to_string();
        let read_time_minutes = (new_post.body.split_whitespace().count() / 200).max(1) as u16;

        let article = Article {
            id,
            slug: slug.clone(),
            title: new_post.title.clone(),
            excerpt: new_post.excerpt.clone(),
            content_gdoc_id: new_post.content_gdoc_id.clone(),
            author_id,
            category: new_post.category_name.clone(),
            tags: new_post.tags.clone(),
            status,
            created_at: now,
            updated_at: now,
            views: 0,
            body: new_post.body.clone(),
            cover_image_url: new_post.cover_image_url.clone(),
            category_detail: None,
            author_detail: None,
            read_time_minutes,
        };

        if let Some(mock_posts) = &self.mock_posts {
            mock_posts.write().await.push(article.clone());
            return Ok(article);
        }

        self.ensure_posts_sheet_schema().await?;

        let token = self.get_access_token().await?;
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}:append?valueInputOption=USER_ENTERED",
            self.spreadsheet_id, POSTS_APPEND_RANGE
        );

        let row = vec![
            id.to_string(),
            slug,
            new_post.title,
            new_post.excerpt,
            new_post.content_gdoc_id.unwrap_or_default(),
            author_id.to_string(),
            new_post.category_name,
            new_post.tags.join(", "),
            "Published".to_string(),
            now.to_rfc3339(),
            now.to_rfc3339(),
            "0".to_string(),
            new_post.cover_image_url.clone().unwrap_or_default(),
            new_post.body,
        ];

        let body = SheetValueUpdate {
            range: POSTS_APPEND_RANGE.to_string(),
            major_dimension: "ROWS".to_string(),
            values: vec![row],
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .context("Google Sheets append request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Google Sheets append returned HTTP {status}: {error_body}");
        }

        let _ = self.cache.invalidate_articles().await;
        Ok(article)
    }

    pub async fn update_post_views(&self, slug: &str) -> Result<()> {
        if let Some(mock_posts) = &self.mock_posts {
            let mut posts = mock_posts.write().await;
            if let Some(post) = posts.iter_mut().find(|item| item.slug == slug) {
                post.views += 1;
                post.updated_at = Utc::now();
                return Ok(());
            }
            bail!("Post with slug '{}' not found in test store", slug);
        }

        let rows = self.read_range(POSTS_LOOKUP_RANGE).await?;
        let mut target_row_idx = None;
        let mut current_views = 0;

        for (idx, row) in rows.iter().enumerate() {
            if row.len() >= 12 && row[1] == slug {
                target_row_idx = Some(idx + 1);
                current_views = row[11].parse::<u32>().unwrap_or(0);
                break;
            }
        }

        let row_idx = match target_row_idx {
            Some(idx) => idx,
            None => bail!("Post with slug '{}' not found in sheets", slug),
        };

        let token = self.get_access_token().await?;
        let update_range = format!("posts!L{row_idx}");
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}?valueInputOption=USER_ENTERED",
            self.spreadsheet_id, update_range
        );
        let body = SheetValueUpdate {
            range: update_range,
            major_dimension: "ROWS".to_string(),
            values: vec![vec![(current_views + 1).to_string()]],
        };

        self.client
            .put(&url)
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .context("Google Sheets update request failed")?
            .error_for_status()
            .context("Google Sheets update returned non-success status")?;

        let _ = self
            .cache
            .invalidate(&crate::services::cache::keys::article_by_slug(slug))
            .await;
        let _ = self.cache.invalidate_articles().await;
        Ok(())
    }
}
