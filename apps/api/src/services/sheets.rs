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

        let category_name = row[6].clone();
        let category_color = match category_name.to_lowercase().as_str() {
            "campus news" => "#d4613c",
            "tech & ai" => "#3d7cc9",
            "editorials" => "#8b5e3c",
            "internship diaries" => "#3d8b5f",
            "career paths" => "#9b59a6",
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
            cover_image_url: None,
            category: Category {
                name: category_name,
                color: category_color.to_string(),
            },
            author: Author {
                id: author_id,
                name: "Unknown Author".to_string(),
                avatar_url: None,
            },
            read_time_minutes: 5,
        })
    }

    async fn read_range(&self, range: &str) -> Result<Vec<Vec<String>>> {
        let token = self.get_access_token().await?;
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}",
            self.spreadsheet_id, range
        );

        let response: SheetValueRange = self
            .client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("Google Sheets read request failed")?
            .error_for_status()
            .context("Google Sheets read returned non-success status")?
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
        if let Some(mock_posts) = &self.mock_posts {
            let posts = mock_posts.read().await.clone();
            let mut previews: Vec<ArticlePreview> =
                posts.iter().map(ArticlePreview::from).collect();
            previews.sort_by(|a, b| b.created_at.cmp(&a.created_at));
            let filtered = if let Some(category_slug) = category {
                previews
                    .into_iter()
                    .filter(|item| {
                        item.category.name.to_lowercase().replace(' ', "-") == category_slug
                    })
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

        let rows = self.read_range("posts!A2:L").await?;
        let mut previews: Vec<ArticlePreview> = rows
            .iter()
            .filter_map(|row| Self::row_to_article_preview(row))
            .filter(|item| item.status.eq_ignore_ascii_case("Published"))
            .collect();

        if let Some(category_slug) = category {
            previews.retain(|item| {
                item.category.name.to_lowercase().replace(' ', "-") == category_slug
            });
        }

        previews.sort_by(|a, b| b.created_at.cmp(&a.created_at));
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

    pub async fn get_post_by_slug(&self, slug: &str) -> Result<Option<Article>> {
        if let Some(mock_posts) = &self.mock_posts {
            let posts = mock_posts.read().await;
            return Ok(posts.iter().find(|item| item.slug == slug).cloned());
        }

        let cache_key = crate::services::cache::keys::article_by_slug(slug);
        if let Ok(Some(cached)) = self.cache.get::<Article>(&cache_key).await {
            return Ok(Some(cached));
        }

        let rows = self.read_range("posts!A2:L").await?;
        for row in rows {
            if row.len() >= 2
                && row[1] == slug
                && let Some(preview) = Self::row_to_article_preview(&row)
            {
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
                    body: String::new(),
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
        let status = "Draft".to_string();
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

        let token = self.get_access_token().await?;
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/posts!A:A:append?valueInputOption=USER_ENTERED",
            self.spreadsheet_id
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
            "Draft".to_string(),
            now.to_rfc3339(),
            now.to_rfc3339(),
            "0".to_string(),
        ];

        let body = SheetValueUpdate {
            range: "posts!A:A".to_string(),
            major_dimension: "ROWS".to_string(),
            values: vec![row],
        };

        self.client
            .post(&url)
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .context("Google Sheets append request failed")?
            .error_for_status()
            .context("Google Sheets append returned non-success status")?;

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

        let rows = self.read_range("posts!A:L").await?;
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
