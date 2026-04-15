//! Postgres-backed article storage (Neon compatible).

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::article::{Article, ArticlePreview, Author, Category, NewArticle};

#[derive(Debug, Clone)]
pub struct PostgresArticlesService {
    pool: PgPool,
    cache: crate::services::cache::CacheService,
}

#[derive(sqlx::FromRow)]
struct ArticlePreviewRow {
    id: Uuid,
    slug: String,
    title: String,
    excerpt: String,
    content_gdoc_id: Option<String>,
    tags: Vec<String>,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    views: i32,
    cover_image_url: Option<String>,
    category_name: String,
    author_id: Uuid,
}

#[derive(sqlx::FromRow)]
struct ArticleRow {
    id: Uuid,
    slug: String,
    title: String,
    excerpt: String,
    body: String,
    content_gdoc_id: Option<String>,
    author_id: Uuid,
    category_name: String,
    tags: Vec<String>,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    views: i32,
    cover_image_url: Option<String>,
}

impl PostgresArticlesService {
    pub fn new(pool: PgPool, cache: crate::services::cache::CacheService) -> Self {
        Self { pool, cache }
    }

    pub async fn get_posts(
        &self,
        limit: usize,
        offset: usize,
        category: Option<&str>,
    ) -> Result<Vec<ArticlePreview>> {
        let cache_key =
            crate::services::cache::keys::article_list(offset as u32, limit as u32, category);
        if let Ok(Some(cached)) = self.cache.get::<Vec<ArticlePreview>>(&cache_key).await {
            return Ok(cached);
        }

        let rows: Vec<ArticlePreviewRow> = sqlx::query_as(
            r#"
            SELECT
              id,
              slug,
              title,
              excerpt,
              content_gdoc_id,
              tags,
              status,
              created_at,
              updated_at,
              views,
              cover_image_url,
              category_name,
              author_id
            FROM articles
            WHERE (lower(status) = 'published' OR lower(status) = 'draft')
              AND ($1::text IS NULL OR category_slug = $1)
            ORDER BY created_at DESC
            LIMIT $2
            OFFSET $3
            "#,
        )
        .bind(category)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .context("Failed to list articles from Postgres")?;

        let previews: Vec<ArticlePreview> = rows
            .into_iter()
            .map(|row| {
                let read_time_minutes = read_time_minutes(&row.excerpt);
                ArticlePreview {
                    id: row.id,
                    title: row.title,
                    slug: row.slug,
                    excerpt: row.excerpt,
                    content_gdoc_id: row.content_gdoc_id,
                    tags: row.tags,
                    status: row.status,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    views: row.views.max(0) as u32,
                    cover_image_url: row.cover_image_url,
                    category: Category {
                        name: row.category_name.clone(),
                        color: category_color_hex(&row.category_name).to_string(),
                    },
                    author: Author {
                        id: row.author_id,
                        name: "Unknown Author".to_string(),
                        avatar_url: None,
                    },
                    read_time_minutes,
                }
            })
            .collect();

        let _ = self
            .cache
            .set(
                &cache_key,
                &previews,
                crate::services::cache::ttl::ARTICLE_LIST,
            )
            .await;

        Ok(previews)
    }

    pub async fn count_posts(&self, category: Option<&str>) -> Result<u32> {
        let cache_key = crate::services::cache::keys::article_count(category);
        if let Ok(Some(cached)) = self.cache.get::<u32>(&cache_key).await {
            return Ok(cached);
        }

        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM articles
            WHERE (lower(status) = 'published' OR lower(status) = 'draft')
              AND ($1::text IS NULL OR category_slug = $1)
            "#,
        )
        .bind(category)
        .fetch_one(&self.pool)
        .await
        .context("Failed to count articles in Postgres")?;

        let total = count.max(0) as u32;
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
        let cache_key = crate::services::cache::keys::article_by_slug(slug);
        if let Ok(Some(cached)) = self.cache.get::<Article>(&cache_key).await {
            return Ok(Some(cached));
        }

        let row: Option<ArticleRow> = sqlx::query_as(
            r#"
            SELECT
              id,
              slug,
              title,
              excerpt,
              body,
              content_gdoc_id,
              author_id,
              category_name,
              tags,
              status,
              created_at,
              updated_at,
              views,
              cover_image_url
            FROM articles
            WHERE slug = $1
            LIMIT 1
            "#,
        )
        .bind(slug)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch article from Postgres")?;

        let row = match row {
            Some(row) => row,
            None => return Ok(None),
        };

        let category_name = row.category_name;
        let category_color = category_color_hex(&category_name).to_string();
        let resolved_body = if row.body.trim().is_empty() {
            format!("<p>{}</p>", row.excerpt)
        } else {
            row.body
        };
        let word_source = if resolved_body.trim().is_empty() {
            row.excerpt.as_str()
        } else {
            resolved_body.as_str()
        };
        let resolved_read_time_minutes = read_time_minutes(word_source);

        let article = Article {
            id: row.id,
            slug: row.slug,
            title: row.title,
            excerpt: row.excerpt,
            content_gdoc_id: row.content_gdoc_id,
            author_id: row.author_id,
            category: category_name.clone(),
            tags: row.tags,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            views: row.views.max(0) as u32,
            body: resolved_body,
            cover_image_url: row.cover_image_url,
            category_detail: Some(Category {
                name: category_name,
                color: category_color,
            }),
            author_detail: Some(Author {
                id: row.author_id,
                name: "Unknown Author".to_string(),
                avatar_url: None,
            }),
            read_time_minutes: resolved_read_time_minutes,
        };

        let _ = self
            .cache
            .set(
                &cache_key,
                &article,
                crate::services::cache::ttl::ARTICLE_DETAIL,
            )
            .await;

        Ok(Some(article))
    }

    pub async fn create_post(&self, new_post: NewArticle, author_id: Uuid) -> Result<Article> {
        let id = Uuid::new_v4();
        let base_slug = slug::slugify(&new_post.title);
        let now = Utc::now();
        let status = "Published".to_string();
        let category_slug = slug::slugify(&new_post.category_name);

        let mut slug = base_slug;
        for attempt in 0..3 {
            let insert = sqlx::query(
                r#"
                INSERT INTO articles (
                  id,
                  slug,
                  title,
                  excerpt,
                  body,
                  content_gdoc_id,
                  author_id,
                  category_name,
                  category_slug,
                  tags,
                  status,
                  created_at,
                  updated_at,
                  views,
                  cover_image_url
                ) VALUES (
                  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
                )
                "#,
            )
            .bind(id)
            .bind(&slug)
            .bind(&new_post.title)
            .bind(&new_post.excerpt)
            .bind(&new_post.body)
            .bind(&new_post.content_gdoc_id)
            .bind(author_id)
            .bind(&new_post.category_name)
            .bind(&category_slug)
            .bind(&new_post.tags)
            .bind(&status)
            .bind(now)
            .bind(now)
            .bind(0_i32)
            .bind(&new_post.cover_image_url)
            .execute(&self.pool)
            .await;

            match insert {
                Ok(_) => break,
                Err(error) => {
                    let unique_violation = error
                        .as_database_error()
                        .and_then(|db_error| db_error.code().map(|code| code.to_string()))
                        .is_some_and(|code| code == "23505");

                    if unique_violation && attempt < 2 {
                        let suffix = &Uuid::new_v4().simple().to_string()[..8];
                        slug = format!("{slug}-{suffix}");
                        continue;
                    }

                    return Err(error).context("Failed to insert article into Postgres");
                }
            }
        }

        let read_time_minutes = read_time_minutes(&new_post.body);

        let article = Article {
            id,
            slug: slug.clone(),
            title: new_post.title,
            excerpt: new_post.excerpt,
            content_gdoc_id: new_post.content_gdoc_id,
            author_id,
            category: new_post.category_name,
            tags: new_post.tags,
            status,
            created_at: now,
            updated_at: now,
            views: 0,
            body: new_post.body,
            cover_image_url: new_post.cover_image_url,
            category_detail: None,
            author_detail: None,
            read_time_minutes,
        };

        let _ = self.cache.invalidate_articles().await;
        Ok(article)
    }

    pub async fn update_post_views(&self, slug: &str) -> Result<()> {
        let result = sqlx::query(
            r#"
            UPDATE articles
            SET views = views + 1,
                updated_at = now()
            WHERE slug = $1
            "#,
        )
        .bind(slug)
        .execute(&self.pool)
        .await
        .context("Failed to increment views in Postgres")?;

        if result.rows_affected() == 0 {
            bail!("Post with slug '{}' not found in postgres", slug);
        }

        let _ = self
            .cache
            .invalidate(&crate::services::cache::keys::article_by_slug(slug))
            .await;
        let _ = self.cache.invalidate_articles().await;
        Ok(())
    }
}

fn read_time_minutes(text: &str) -> u16 {
    (text.split_whitespace().count() / 200).max(1) as u16
}

fn category_color_hex(category_name: &str) -> &'static str {
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
