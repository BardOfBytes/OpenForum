//! Articles storage abstraction.

use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::article::{Article, ArticlePreview, NewArticle};

use super::{articles_postgres::PostgresArticlesService, sheets::SheetsService};

#[derive(Clone)]
pub enum ArticlesService {
    Sheets(Arc<SheetsService>),
    Postgres(Arc<PostgresArticlesService>),
}

impl ArticlesService {
    pub async fn get_posts(
        &self,
        limit: usize,
        offset: usize,
        category: Option<&str>,
    ) -> Result<Vec<ArticlePreview>> {
        match self {
            Self::Sheets(service) => service.get_posts(limit, offset, category).await,
            Self::Postgres(service) => service.get_posts(limit, offset, category).await,
        }
    }

    pub async fn count_posts(&self, category: Option<&str>) -> Result<u32> {
        match self {
            Self::Sheets(service) => service.count_posts(category).await,
            Self::Postgres(service) => service.count_posts(category).await,
        }
    }

    pub async fn get_post_by_slug(&self, slug: &str) -> Result<Option<Article>> {
        match self {
            Self::Sheets(service) => service.get_post_by_slug(slug).await,
            Self::Postgres(service) => service.get_post_by_slug(slug).await,
        }
    }

    pub async fn create_post(&self, new_post: NewArticle, author_id: Uuid) -> Result<Article> {
        match self {
            Self::Sheets(service) => service.create_post(new_post, author_id).await,
            Self::Postgres(service) => service.create_post(new_post, author_id).await,
        }
    }

    pub async fn update_post_views(&self, slug: &str) -> Result<()> {
        match self {
            Self::Sheets(service) => service.update_post_views(slug).await,
            Self::Postgres(service) => service.update_post_views(slug).await,
        }
    }
}
