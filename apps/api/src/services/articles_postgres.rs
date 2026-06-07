//! Postgres-backed article storage (Neon compatible).

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::article::{
    Article, ArticlePreview, Author, AuthorSummary, Category, NewArticle,
    youtube_thumbnail_from_html,
};

use super::articles::{ArticleSocialState, Comment, SocialState, UpdateArticle};

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
    body: String,
    content_gdoc_id: Option<String>,
    tags: Vec<String>,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    views: i32,
    featured: bool,
    cover_image_url: Option<String>,
    category_name: String,
    author_id: Uuid,
    author_name: String,
    author_avatar_url: Option<String>,
    author_username: Option<String>,
    author_headline: Option<String>,
    author_bio: Option<String>,
    author_articles_published: i64,
    author_total_views: i64,
}

#[derive(sqlx::FromRow)]
struct ArticleRow {
    id: Uuid,
    slug: String,
    title: String,
    subtitle: String,
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
    author_name: String,
    author_avatar_url: Option<String>,
    author_username: Option<String>,
    author_headline: Option<String>,
    author_bio: Option<String>,
    author_articles_published: i64,
    author_total_views: i64,
}

#[derive(sqlx::FromRow)]
struct CommentRow {
    id: Uuid,
    article_id: Uuid,
    author_id: Uuid,
    author_name: String,
    author_avatar_url: Option<String>,
    body: String,
    parent_id: Option<Uuid>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct AuthorSummaryRow {
    id: Uuid,
    name: String,
    username: Option<String>,
    avatar_url: Option<String>,
    headline: Option<String>,
    bio: Option<String>,
    articles_published: i64,
    total_views: i64,
    follower_count: i32,
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
        search: Option<&str>,
        author: Option<Uuid>,
    ) -> Result<Vec<ArticlePreview>> {
        let search = search.map(str::trim).filter(|search| !search.is_empty());
        let cache_key = if search.is_none() && author.is_none() {
            Some(crate::services::cache::keys::article_list(
                offset as u32,
                limit as u32,
                category,
            ))
        } else {
            None
        };
        if let Some(cache_key) = cache_key.as_deref() {
            if let Ok(Some(cached)) = self.cache.get::<Vec<ArticlePreview>>(cache_key).await {
                return Ok(cached);
            }
        }

        let rows: Vec<ArticlePreviewRow> = sqlx::query_as(
            r#"
            SELECT
              a.id,
              a.slug,
              a.title,
              a.excerpt,
              a.body,
              a.content_gdoc_id,
              a.tags,
              a.status,
              a.created_at,
              a.updated_at,
              a.views,
              coalesce(a.featured, false) as featured,
              a.cover_image_url,
              a.category_name,
              a.author_id,
              coalesce(
                nullif(trim(p.display_name), ''),
                nullif(trim(p.username), ''),
                nullif(split_part(p.email, '@', 1), ''),
                'Unknown Author'
              ) as author_name,
              p.avatar_url as author_avatar_url,
              p.username as author_username,
              p.headline as author_headline,
              p.bio as author_bio,
              coalesce(author_stats.articles_published, 0) as author_articles_published,
              coalesce(author_stats.total_views, 0) as author_total_views
            FROM articles a
            LEFT JOIN profiles p ON p.id = a.author_id
            LEFT JOIN LATERAL (
              SELECT
                count(*)::bigint as articles_published,
                coalesce(sum(views), 0)::bigint as total_views
              FROM articles authored_articles
              WHERE authored_articles.author_id = a.author_id
                AND lower(authored_articles.status) = 'published'
            ) author_stats ON true
            WHERE (lower(a.status) = 'published' OR lower(a.status) = 'draft')
              AND ($1::text IS NULL OR a.category_slug = $1)
              AND ($4::uuid IS NULL OR a.author_id = $4)
              AND (
                $5::text IS NULL
                OR a.title ILIKE '%' || $5 || '%'
                OR a.excerpt ILIKE '%' || $5 || '%'
                OR a.body ILIKE '%' || $5 || '%'
                OR coalesce(p.display_name, p.username, p.email, '') ILIKE '%' || $5 || '%'
              )
            ORDER BY coalesce(a.featured, false) DESC, a.created_at DESC
            LIMIT $2
            OFFSET $3
            "#,
        )
        .persistent(false)
        .bind(category)
        .bind(limit as i64)
        .bind(offset as i64)
        .bind(author)
        .bind(search)
        .fetch_all(&self.pool)
        .await
        .context("Failed to list articles from Postgres")?;

        let previews: Vec<ArticlePreview> = rows
            .into_iter()
            .map(|row| {
                let read_time_minutes = read_time_minutes(&row.excerpt);
                let preview_image_url = row
                    .cover_image_url
                    .clone()
                    .or_else(|| youtube_thumbnail_from_html(&row.body));

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
                    featured: row.featured,
                    cover_image_url: row.cover_image_url,
                    preview_image_url,
                    category: Category {
                        name: row.category_name.clone(),
                        color: category_color_hex(&row.category_name).to_string(),
                    },
                    author: Author {
                        id: row.author_id,
                        name: row.author_name,
                        avatar_url: row.author_avatar_url,
                        username: row.author_username,
                        headline: row.author_headline,
                        bio: row.author_bio,
                        articles_published: row.author_articles_published.max(0) as u32,
                        total_views: row.author_total_views.max(0) as u32,
                    },
                    read_time_minutes,
                }
            })
            .collect();

        if let Some(cache_key) = cache_key.as_deref() {
            let _ = self
                .cache
                .set(
                    cache_key,
                    &previews,
                    crate::services::cache::ttl::ARTICLE_LIST,
                )
                .await;
        }

        Ok(previews)
    }

    pub async fn count_posts(
        &self,
        category: Option<&str>,
        search: Option<&str>,
        author: Option<Uuid>,
    ) -> Result<u32> {
        let search = search.map(str::trim).filter(|search| !search.is_empty());
        let cache_key = if search.is_none() && author.is_none() {
            Some(crate::services::cache::keys::article_count(category))
        } else {
            None
        };
        if let Some(cache_key) = cache_key.as_deref() {
            if let Ok(Some(cached)) = self.cache.get::<u32>(cache_key).await {
                return Ok(cached);
            }
        }

        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM articles a
            LEFT JOIN profiles p ON p.id = a.author_id
            WHERE (lower(a.status) = 'published' OR lower(a.status) = 'draft')
              AND ($1::text IS NULL OR a.category_slug = $1)
              AND ($2::uuid IS NULL OR a.author_id = $2)
              AND (
                $3::text IS NULL
                OR a.title ILIKE '%' || $3 || '%'
                OR a.excerpt ILIKE '%' || $3 || '%'
                OR a.body ILIKE '%' || $3 || '%'
                OR coalesce(p.display_name, p.username, p.email, '') ILIKE '%' || $3 || '%'
              )
            "#,
        )
        .persistent(false)
        .bind(category)
        .bind(author)
        .bind(search)
        .fetch_one(&self.pool)
        .await
        .context("Failed to count articles in Postgres")?;

        let total = count.max(0) as u32;
        if let Some(cache_key) = cache_key.as_deref() {
            let _ = self
                .cache
                .set(
                    cache_key,
                    &total,
                    crate::services::cache::ttl::ARTICLE_COUNT,
                )
                .await;
        }

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
              a.id,
              a.slug,
              a.title,
              a.subtitle,
              a.excerpt,
              a.body,
              a.content_gdoc_id,
              a.author_id,
              a.category_name,
              a.tags,
              a.status,
              a.created_at,
              a.updated_at,
              a.views,
              a.cover_image_url,
              coalesce(
                nullif(trim(p.display_name), ''),
                nullif(trim(p.username), ''),
                nullif(split_part(p.email, '@', 1), ''),
                'Unknown Author'
              ) as author_name,
              p.avatar_url as author_avatar_url,
              p.username as author_username,
              p.headline as author_headline,
              p.bio as author_bio,
              coalesce(author_stats.articles_published, 0) as author_articles_published,
              coalesce(author_stats.total_views, 0) as author_total_views
            FROM articles a
            LEFT JOIN profiles p ON p.id = a.author_id
            LEFT JOIN LATERAL (
              SELECT
                count(*)::bigint as articles_published,
                coalesce(sum(views), 0)::bigint as total_views
              FROM articles authored_articles
              WHERE authored_articles.author_id = a.author_id
                AND lower(authored_articles.status) = 'published'
            ) author_stats ON true
            WHERE a.slug = $1
            LIMIT 1
            "#,
        )
        .persistent(false)
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
            subtitle: row.subtitle,
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
                name: row.author_name,
                avatar_url: row.author_avatar_url,
                username: row.author_username,
                headline: row.author_headline,
                bio: row.author_bio,
                articles_published: row.author_articles_published.max(0) as u32,
                total_views: row.author_total_views.max(0) as u32,
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

    pub async fn list_authors(&self, limit: usize) -> Result<Vec<AuthorSummary>> {
        let rows: Vec<AuthorSummaryRow> = sqlx::query_as(
            r#"
            SELECT
              p.id,
              coalesce(
                nullif(trim(p.display_name), ''),
                nullif(trim(p.username), ''),
                nullif(split_part(p.email, '@', 1), ''),
                'Unknown Author'
              ) as name,
              p.username,
              p.avatar_url,
              p.headline,
              p.bio,
              count(a.id)::bigint as articles_published,
              coalesce(sum(a.views), 0)::bigint as total_views,
              coalesce(p.followers_count, 0) as follower_count
            FROM profiles p
            JOIN articles a ON a.author_id = p.id
            WHERE lower(a.status) = 'published'
            GROUP BY
              p.id,
              p.display_name,
              p.username,
              p.email,
              p.avatar_url,
              p.headline,
              p.bio,
              p.followers_count
            ORDER BY count(a.id) DESC, coalesce(sum(a.views), 0) DESC, p.display_name ASC
            LIMIT $1
            "#,
        )
        .persistent(false)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .context("Failed to list authors from Postgres")?;

        Ok(rows
            .into_iter()
            .map(|row| AuthorSummary {
                id: row.id,
                name: row.name,
                username: row.username,
                avatar_url: row.avatar_url,
                headline: row.headline,
                bio: row.bio,
                articles_published: row.articles_published.max(0) as u32,
                total_views: row.total_views.max(0) as u32,
                follower_count: row.follower_count.max(0) as u32,
            })
            .collect())
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
                  subtitle,
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
                  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
                )
                "#,
            )
            .persistent(false)
            .bind(id)
            .bind(&slug)
            .bind(&new_post.title)
            .bind(&new_post.subtitle)
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
            subtitle: new_post.subtitle,
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

    pub async fn update_post(
        &self,
        slug: &str,
        patch: UpdateArticle,
        actor_id: Uuid,
        can_manage_all: bool,
    ) -> Result<Option<Article>> {
        let current = match self.get_post_by_slug(slug).await? {
            Some(article) => article,
            None => return Ok(None),
        };

        if !can_manage_all && current.author_id != actor_id {
            return Ok(None);
        }

        let title = patch.title.unwrap_or_else(|| current.title.clone());
        let subtitle = patch.subtitle.unwrap_or_else(|| current.subtitle.clone());
        let body = patch.body.unwrap_or_else(|| current.body.clone());
        let excerpt = patch.excerpt.unwrap_or_else(|| current.excerpt.clone());
        let content_gdoc_id = patch.content_gdoc_id.unwrap_or(current.content_gdoc_id);
        let cover_image_url = patch.cover_image_url.unwrap_or(current.cover_image_url);
        let category_name = patch
            .category_name
            .unwrap_or_else(|| current.category.clone());
        let category_slug = slug::slugify(&category_name);
        let tags = patch.tags.unwrap_or(current.tags);
        let status = patch.status.unwrap_or(current.status);

        sqlx::query(
            r#"
            UPDATE articles
            SET title = $1,
                subtitle = $2,
                excerpt = $3,
                body = $4,
                content_gdoc_id = $5,
                category_name = $6,
                category_slug = $7,
                tags = $8,
                status = $9,
                cover_image_url = $10,
                updated_at = now()
            WHERE slug = $11
              AND ($12::boolean OR author_id = $13)
            "#,
        )
        .persistent(false)
        .bind(title)
        .bind(subtitle)
        .bind(excerpt)
        .bind(body)
        .bind(content_gdoc_id)
        .bind(category_name)
        .bind(category_slug)
        .bind(tags)
        .bind(status)
        .bind(cover_image_url)
        .bind(slug)
        .bind(can_manage_all)
        .bind(actor_id)
        .execute(&self.pool)
        .await
        .context("Failed to update article in Postgres")?;

        let _ = self
            .cache
            .invalidate(&crate::services::cache::keys::article_by_slug(slug))
            .await;
        let _ = self.cache.invalidate_articles().await;

        self.get_post_by_slug(slug).await
    }

    pub async fn delete_post(
        &self,
        slug: &str,
        actor_id: Uuid,
        can_manage_all: bool,
    ) -> Result<bool> {
        let result = sqlx::query(
            r#"
            DELETE FROM articles
            WHERE slug = $1
              AND ($2::boolean OR author_id = $3)
            "#,
        )
        .persistent(false)
        .bind(slug)
        .bind(can_manage_all)
        .bind(actor_id)
        .execute(&self.pool)
        .await
        .context("Failed to delete article from Postgres")?;

        let deleted = result.rows_affected() > 0;
        if deleted {
            let _ = self
                .cache
                .invalidate(&crate::services::cache::keys::article_by_slug(slug))
                .await;
            let _ = self.cache.invalidate_articles().await;
        }
        Ok(deleted)
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
        .persistent(false)
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

    pub async fn like_article(&self, slug: &str, user_id: Uuid) -> Result<Option<SocialState>> {
        let Some(article_id) = self.article_id_by_slug(slug).await? else {
            return Ok(None);
        };

        sqlx::query(
            r#"
            INSERT INTO likes (user_id, article_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, article_id) DO NOTHING
            "#,
        )
        .persistent(false)
        .bind(user_id)
        .bind(article_id)
        .execute(&self.pool)
        .await
        .context("Failed to like article in Postgres")?;

        Ok(Some(SocialState {
            active: true,
            count: self.count_article_rows("likes", article_id).await?,
        }))
    }

    pub async fn article_social_state(
        &self,
        slug: &str,
        viewer_id: Option<Uuid>,
    ) -> Result<Option<ArticleSocialState>> {
        let Some(article_id) = self.article_id_by_slug(slug).await? else {
            return Ok(None);
        };

        let liked = if let Some(viewer_id) = viewer_id {
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND article_id = $2)",
            )
            .persistent(false)
            .bind(viewer_id)
            .bind(article_id)
            .fetch_one(&self.pool)
            .await
            .context("Failed to resolve article like state")?
        } else {
            false
        };

        let bookmarked = if let Some(viewer_id) = viewer_id {
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $1 AND article_id = $2)",
            )
            .persistent(false)
            .bind(viewer_id)
            .bind(article_id)
            .fetch_one(&self.pool)
            .await
            .context("Failed to resolve article bookmark state")?
        } else {
            false
        };

        Ok(Some(ArticleSocialState {
            like: SocialState {
                active: liked,
                count: self.count_article_rows("likes", article_id).await?,
            },
            bookmark: SocialState {
                active: bookmarked,
                count: self.count_article_rows("bookmarks", article_id).await?,
            },
        }))
    }

    pub async fn unlike_article(&self, slug: &str, user_id: Uuid) -> Result<Option<SocialState>> {
        let Some(article_id) = self.article_id_by_slug(slug).await? else {
            return Ok(None);
        };

        sqlx::query("DELETE FROM likes WHERE user_id = $1 AND article_id = $2")
            .persistent(false)
            .bind(user_id)
            .bind(article_id)
            .execute(&self.pool)
            .await
            .context("Failed to unlike article in Postgres")?;

        Ok(Some(SocialState {
            active: false,
            count: self.count_article_rows("likes", article_id).await?,
        }))
    }

    pub async fn bookmark_article(&self, slug: &str, user_id: Uuid) -> Result<Option<SocialState>> {
        let Some(article_id) = self.article_id_by_slug(slug).await? else {
            return Ok(None);
        };

        sqlx::query(
            r#"
            INSERT INTO bookmarks (user_id, article_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, article_id) DO NOTHING
            "#,
        )
        .persistent(false)
        .bind(user_id)
        .bind(article_id)
        .execute(&self.pool)
        .await
        .context("Failed to bookmark article in Postgres")?;

        Ok(Some(SocialState {
            active: true,
            count: self.count_article_rows("bookmarks", article_id).await?,
        }))
    }

    pub async fn unbookmark_article(
        &self,
        slug: &str,
        user_id: Uuid,
    ) -> Result<Option<SocialState>> {
        let Some(article_id) = self.article_id_by_slug(slug).await? else {
            return Ok(None);
        };

        sqlx::query("DELETE FROM bookmarks WHERE user_id = $1 AND article_id = $2")
            .persistent(false)
            .bind(user_id)
            .bind(article_id)
            .execute(&self.pool)
            .await
            .context("Failed to remove article bookmark in Postgres")?;

        Ok(Some(SocialState {
            active: false,
            count: self.count_article_rows("bookmarks", article_id).await?,
        }))
    }

    pub async fn list_comments(&self, slug: &str) -> Result<Option<Vec<Comment>>> {
        let Some(article_id) = self.article_id_by_slug(slug).await? else {
            return Ok(None);
        };

        let rows: Vec<CommentRow> = sqlx::query_as(
            r#"
            SELECT
              c.id,
              c.article_id,
              c.author_id,
              coalesce(
                nullif(trim(p.display_name), ''),
                nullif(trim(p.username), ''),
                nullif(split_part(p.email, '@', 1), ''),
                'Unknown Author'
              ) as author_name,
              p.avatar_url as author_avatar_url,
              c.body,
              c.parent_id,
              c.created_at,
              c.updated_at
            FROM comments c
            LEFT JOIN profiles p ON p.id = c.author_id
            WHERE c.article_id = $1
              AND coalesce(c.is_hidden, false) = false
            ORDER BY c.created_at ASC
            "#,
        )
        .persistent(false)
        .bind(article_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to list comments from Postgres")?;

        Ok(Some(rows.into_iter().map(comment_from_row).collect()))
    }

    pub async fn create_comment(
        &self,
        slug: &str,
        author_id: Uuid,
        body: String,
        parent_id: Option<Uuid>,
    ) -> Result<Option<Comment>> {
        let Some(article_id) = self.article_id_by_slug(slug).await? else {
            return Ok(None);
        };

        let row: CommentRow = sqlx::query_as(
            r#"
            WITH inserted AS (
              INSERT INTO comments (article_id, author_id, body, parent_id)
              VALUES ($1, $2, $3, $4)
              RETURNING id, article_id, author_id, body, parent_id, created_at, updated_at
            )
            SELECT
              inserted.id,
              inserted.article_id,
              inserted.author_id,
              coalesce(
                nullif(trim(p.display_name), ''),
                nullif(trim(p.username), ''),
                nullif(split_part(p.email, '@', 1), ''),
                'Unknown Author'
              ) as author_name,
              p.avatar_url as author_avatar_url,
              inserted.body,
              inserted.parent_id,
              inserted.created_at,
              inserted.updated_at
            FROM inserted
            LEFT JOIN profiles p ON p.id = inserted.author_id
            "#,
        )
        .persistent(false)
        .bind(article_id)
        .bind(author_id)
        .bind(body)
        .bind(parent_id)
        .fetch_one(&self.pool)
        .await
        .context("Failed to create comment in Postgres")?;

        Ok(Some(comment_from_row(row)))
    }

    pub async fn update_comment(
        &self,
        comment_id: Uuid,
        author_id: Uuid,
        body: String,
    ) -> Result<Option<Comment>> {
        let row: Option<CommentRow> = sqlx::query_as(
            r#"
            WITH updated AS (
              UPDATE comments
              SET body = $1,
                  updated_at = now()
              WHERE id = $2 AND author_id = $3
              RETURNING id, article_id, author_id, body, parent_id, created_at, updated_at
            )
            SELECT
              updated.id,
              updated.article_id,
              updated.author_id,
              coalesce(
                nullif(trim(p.display_name), ''),
                nullif(trim(p.username), ''),
                nullif(split_part(p.email, '@', 1), ''),
                'Unknown Author'
              ) as author_name,
              p.avatar_url as author_avatar_url,
              updated.body,
              updated.parent_id,
              updated.created_at,
              updated.updated_at
            FROM updated
            LEFT JOIN profiles p ON p.id = updated.author_id
            "#,
        )
        .persistent(false)
        .bind(body)
        .bind(comment_id)
        .bind(author_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to update comment in Postgres")?;

        Ok(row.map(comment_from_row))
    }

    pub async fn delete_comment(&self, comment_id: Uuid, author_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM comments WHERE id = $1 AND author_id = $2")
            .persistent(false)
            .bind(comment_id)
            .bind(author_id)
            .execute(&self.pool)
            .await
            .context("Failed to delete comment from Postgres")?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn hide_comment(&self, comment_id: Uuid, moderator_id: Uuid) -> Result<bool> {
        let result = sqlx::query(
            r#"
            UPDATE comments
            SET is_hidden = true,
                hidden_at = coalesce(hidden_at, now()),
                hidden_by = coalesce(hidden_by, $2),
                updated_at = now()
            WHERE id = $1
              AND coalesce(is_hidden, false) = false
            "#,
        )
        .persistent(false)
        .bind(comment_id)
        .bind(moderator_id)
        .execute(&self.pool)
        .await
        .context("Failed to hide comment in Postgres")?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn delete_comment_as_moderator(&self, comment_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM comments WHERE id = $1")
            .persistent(false)
            .bind(comment_id)
            .execute(&self.pool)
            .await
            .context("Failed to delete comment as moderator from Postgres")?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn follow_user(&self, follower_id: Uuid, following_id: Uuid) -> Result<SocialState> {
        if follower_id != following_id {
            sqlx::query(
                r#"
                INSERT INTO follows (follower_id, following_id)
                VALUES ($1, $2)
                ON CONFLICT (follower_id, following_id) DO NOTHING
                "#,
            )
            .persistent(false)
            .bind(follower_id)
            .bind(following_id)
            .execute(&self.pool)
            .await
            .context("Failed to follow user in Postgres")?;
        }

        Ok(SocialState {
            active: follower_id != following_id,
            count: self.count_followers(following_id).await?,
        })
    }

    pub async fn unfollow_user(
        &self,
        follower_id: Uuid,
        following_id: Uuid,
    ) -> Result<SocialState> {
        sqlx::query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2")
            .persistent(false)
            .bind(follower_id)
            .bind(following_id)
            .execute(&self.pool)
            .await
            .context("Failed to unfollow user in Postgres")?;

        Ok(SocialState {
            active: false,
            count: self.count_followers(following_id).await?,
        })
    }

    pub async fn follow_state(
        &self,
        viewer_id: Option<Uuid>,
        following_id: Uuid,
    ) -> Result<SocialState> {
        let active = if let Some(viewer_id) = viewer_id {
            if viewer_id == following_id {
                false
            } else {
                sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)",
                )
                .persistent(false)
                .bind(viewer_id)
                .bind(following_id)
                .fetch_one(&self.pool)
                .await
                .context("Failed to resolve follow state")?
            }
        } else {
            false
        };

        Ok(SocialState {
            active,
            count: self.count_followers(following_id).await?,
        })
    }

    async fn article_id_by_slug(&self, slug: &str) -> Result<Option<Uuid>> {
        sqlx::query_scalar("SELECT id FROM articles WHERE slug = $1 LIMIT 1")
            .persistent(false)
            .bind(slug)
            .fetch_optional(&self.pool)
            .await
            .context("Failed to resolve article id from slug")
    }

    async fn count_article_rows(&self, table: &str, article_id: Uuid) -> Result<u32> {
        let query = match table {
            "likes" => "SELECT COUNT(*) FROM likes WHERE article_id = $1",
            "bookmarks" => "SELECT COUNT(*) FROM bookmarks WHERE article_id = $1",
            _ => bail!("Unsupported social count table '{table}'"),
        };

        let count: i64 = sqlx::query_scalar(query)
            .persistent(false)
            .bind(article_id)
            .fetch_one(&self.pool)
            .await
            .context("Failed to count article social rows")?;
        Ok(count.max(0) as u32)
    }

    async fn count_followers(&self, following_id: Uuid) -> Result<u32> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM follows WHERE following_id = $1")
            .persistent(false)
            .bind(following_id)
            .fetch_one(&self.pool)
            .await
            .context("Failed to count followers")?;
        Ok(count.max(0) as u32)
    }
}

fn comment_from_row(row: CommentRow) -> Comment {
    Comment {
        id: row.id,
        article_id: row.article_id,
        author_id: row.author_id,
        author_name: row.author_name,
        author_avatar_url: row.author_avatar_url,
        body: row.body,
        parent_id: row.parent_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
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
