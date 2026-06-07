//! Articles storage abstraction.

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    sync::{Arc, Mutex},
};
use uuid::Uuid;

use crate::models::article::{
    Article, ArticlePreview, Author, AuthorSummary, Category, NewArticle,
};

use super::articles_postgres::PostgresArticlesService;

#[derive(Clone)]
pub enum ArticlesService {
    Postgres(Arc<PostgresArticlesService>),
    InMemory(Arc<Mutex<InMemoryArticlesState>>),
}

impl ArticlesService {
    pub fn postgres(service: PostgresArticlesService) -> Self {
        Self::Postgres(Arc::new(service))
    }

    pub fn in_memory() -> Self {
        Self::InMemory(Arc::new(Mutex::new(InMemoryArticlesState::default())))
    }

    pub async fn get_posts(
        &self,
        limit: usize,
        offset: usize,
        category: Option<&str>,
        search: Option<&str>,
        author: Option<Uuid>,
    ) -> Result<Vec<ArticlePreview>> {
        match self {
            Self::Postgres(service) => {
                service
                    .get_posts(limit, offset, category, search, author)
                    .await
            }
            Self::InMemory(state) => {
                let state = state.lock().expect("in-memory articles mutex poisoned");
                let previews = state
                    .articles
                    .iter()
                    .filter(|article| article_matches_filters(article, category, search, author))
                    .skip(offset)
                    .take(limit)
                    .map(article_preview_from_article)
                    .collect();
                Ok(previews)
            }
        }
    }

    pub async fn count_posts(
        &self,
        category: Option<&str>,
        search: Option<&str>,
        author: Option<Uuid>,
    ) -> Result<u32> {
        match self {
            Self::Postgres(service) => service.count_posts(category, search, author).await,
            Self::InMemory(state) => {
                let state = state.lock().expect("in-memory articles mutex poisoned");
                Ok(state
                    .articles
                    .iter()
                    .filter(|article| article_matches_filters(article, category, search, author))
                    .count() as u32)
            }
        }
    }

    pub async fn get_post_by_slug(&self, slug: &str) -> Result<Option<Article>> {
        match self {
            Self::Postgres(service) => service.get_post_by_slug(slug).await,
            Self::InMemory(state) => {
                let state = state.lock().expect("in-memory articles mutex poisoned");
                Ok(state
                    .articles
                    .iter()
                    .find(|article| article.slug == slug)
                    .cloned())
            }
        }
    }

    pub async fn list_authors(&self, limit: usize) -> Result<Vec<AuthorSummary>> {
        match self {
            Self::Postgres(service) => service.list_authors(limit).await,
            Self::InMemory(state) => {
                let state = state.lock().expect("in-memory articles mutex poisoned");
                let mut authors: Vec<AuthorSummary> = Vec::new();

                for article in &state.articles {
                    let author = article.author_detail.clone().unwrap_or(Author {
                        id: article.author_id,
                        name: "Test Author".to_string(),
                        avatar_url: None,
                        username: None,
                        headline: None,
                        bio: None,
                        articles_published: 0,
                        total_views: 0,
                    });

                    if let Some(existing) = authors.iter_mut().find(|item| item.id == author.id) {
                        existing.articles_published += 1;
                        existing.total_views += article.views;
                    } else {
                        authors.push(AuthorSummary {
                            id: author.id,
                            name: author.name,
                            username: author.username,
                            avatar_url: author.avatar_url,
                            headline: author.headline,
                            bio: author.bio,
                            articles_published: 1,
                            total_views: article.views,
                            follower_count: 0,
                        });
                    }
                }

                authors.sort_by(|left, right| {
                    right
                        .articles_published
                        .cmp(&left.articles_published)
                        .then_with(|| right.total_views.cmp(&left.total_views))
                });
                authors.truncate(limit);
                Ok(authors)
            }
        }
    }

    pub async fn create_post(&self, new_post: NewArticle, author_id: Uuid) -> Result<Article> {
        match self {
            Self::Postgres(service) => service.create_post(new_post, author_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let mut slug = slug::slugify(&new_post.title);
                if state.articles.iter().any(|article| article.slug == slug) {
                    slug = format!("{slug}-{}", &Uuid::new_v4().simple().to_string()[..8]);
                }

                let now = Utc::now();
                let read_time_minutes = read_time_minutes(&new_post.body);
                let category_color = category_color_hex(&new_post.category_name).to_string();
                let article = Article {
                    id: Uuid::new_v4(),
                    slug,
                    title: new_post.title,
                    subtitle: new_post.subtitle,
                    excerpt: new_post.excerpt,
                    content_gdoc_id: new_post.content_gdoc_id,
                    author_id,
                    category: new_post.category_name.clone(),
                    tags: new_post.tags,
                    status: "Published".to_string(),
                    created_at: now,
                    updated_at: now,
                    views: 0,
                    body: new_post.body,
                    cover_image_url: new_post.cover_image_url,
                    category_detail: Some(Category {
                        name: new_post.category_name,
                        color: category_color,
                    }),
                    author_detail: Some(Author {
                        id: author_id,
                        name: "Test Author".to_string(),
                        avatar_url: None,
                        username: None,
                        headline: None,
                        bio: None,
                        articles_published: 0,
                        total_views: 0,
                    }),
                    read_time_minutes,
                };
                state.articles.insert(0, article.clone());
                Ok(article)
            }
        }
    }

    pub async fn update_post_views(&self, slug: &str) -> Result<()> {
        match self {
            Self::Postgres(service) => service.update_post_views(slug).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                if let Some(article) = state
                    .articles
                    .iter_mut()
                    .find(|article| article.slug == slug)
                {
                    article.views += 1;
                }
                Ok(())
            }
        }
    }

    pub async fn update_post(
        &self,
        slug: &str,
        patch: UpdateArticle,
        actor_id: Uuid,
        can_manage_all: bool,
    ) -> Result<Option<Article>> {
        match self {
            Self::Postgres(service) => {
                service
                    .update_post(slug, patch, actor_id, can_manage_all)
                    .await
            }
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(article) = state
                    .articles
                    .iter_mut()
                    .find(|article| article.slug == slug)
                else {
                    return Ok(None);
                };

                if !can_manage_all && article.author_id != actor_id {
                    return Ok(None);
                }

                if let Some(title) = patch.title {
                    article.title = title;
                }
                if let Some(subtitle) = patch.subtitle {
                    article.subtitle = subtitle;
                }
                if let Some(body) = patch.body {
                    article.body = body;
                }
                if let Some(excerpt) = patch.excerpt {
                    article.excerpt = excerpt;
                }
                if let Some(content_gdoc_id) = patch.content_gdoc_id {
                    article.content_gdoc_id = content_gdoc_id;
                }
                if let Some(cover_image_url) = patch.cover_image_url {
                    article.cover_image_url = cover_image_url;
                }
                if let Some(category_name) = patch.category_name {
                    article.category = category_name.clone();
                    article.category_detail = Some(Category {
                        name: category_name.clone(),
                        color: category_color_hex(&category_name).to_string(),
                    });
                }
                if let Some(tags) = patch.tags {
                    article.tags = tags;
                }
                if let Some(status) = patch.status {
                    article.status = status;
                }
                article.updated_at = Utc::now();
                article.read_time_minutes = read_time_minutes(&article.body);
                Ok(Some(article.clone()))
            }
        }
    }

    pub async fn delete_post(
        &self,
        slug: &str,
        actor_id: Uuid,
        can_manage_all: bool,
    ) -> Result<bool> {
        match self {
            Self::Postgres(service) => service.delete_post(slug, actor_id, can_manage_all).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(index) = state.articles.iter().position(|article| {
                    article.slug == slug && (can_manage_all || article.author_id == actor_id)
                }) else {
                    return Ok(false);
                };

                let article_id = state.articles[index].id;
                state.articles.remove(index);
                state
                    .likes
                    .retain(|(_, liked_article_id)| *liked_article_id != article_id);
                state
                    .bookmarks
                    .retain(|(_, bookmarked_article_id)| *bookmarked_article_id != article_id);
                state
                    .comments
                    .retain(|comment| comment.article_id != article_id);
                Ok(true)
            }
        }
    }

    pub async fn like_article(&self, slug: &str, user_id: Uuid) -> Result<Option<SocialState>> {
        match self {
            Self::Postgres(service) => service.like_article(slug, user_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(article_id) = state.article_id_by_slug(slug) else {
                    return Ok(None);
                };
                state.likes.insert((user_id, article_id));
                Ok(Some(SocialState {
                    active: true,
                    count: state
                        .likes
                        .iter()
                        .filter(|(_, id)| *id == article_id)
                        .count() as u32,
                }))
            }
        }
    }

    pub async fn article_social_state(
        &self,
        slug: &str,
        viewer_id: Option<Uuid>,
    ) -> Result<Option<ArticleSocialState>> {
        match self {
            Self::Postgres(service) => service.article_social_state(slug, viewer_id).await,
            Self::InMemory(state) => {
                let state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(article_id) = state.article_id_by_slug(slug) else {
                    return Ok(None);
                };
                let liked = viewer_id
                    .is_some_and(|viewer_id| state.likes.contains(&(viewer_id, article_id)));
                let bookmarked = viewer_id
                    .is_some_and(|viewer_id| state.bookmarks.contains(&(viewer_id, article_id)));

                Ok(Some(ArticleSocialState {
                    like: SocialState {
                        active: liked,
                        count: state
                            .likes
                            .iter()
                            .filter(|(_, liked_article_id)| *liked_article_id == article_id)
                            .count() as u32,
                    },
                    bookmark: SocialState {
                        active: bookmarked,
                        count: state
                            .bookmarks
                            .iter()
                            .filter(|(_, bookmarked_article_id)| {
                                *bookmarked_article_id == article_id
                            })
                            .count() as u32,
                    },
                }))
            }
        }
    }

    pub async fn unlike_article(&self, slug: &str, user_id: Uuid) -> Result<Option<SocialState>> {
        match self {
            Self::Postgres(service) => service.unlike_article(slug, user_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(article_id) = state.article_id_by_slug(slug) else {
                    return Ok(None);
                };
                state.likes.remove(&(user_id, article_id));
                Ok(Some(SocialState {
                    active: false,
                    count: state
                        .likes
                        .iter()
                        .filter(|(_, id)| *id == article_id)
                        .count() as u32,
                }))
            }
        }
    }

    pub async fn bookmark_article(&self, slug: &str, user_id: Uuid) -> Result<Option<SocialState>> {
        match self {
            Self::Postgres(service) => service.bookmark_article(slug, user_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(article_id) = state.article_id_by_slug(slug) else {
                    return Ok(None);
                };
                state.bookmarks.insert((user_id, article_id));
                Ok(Some(SocialState {
                    active: true,
                    count: state
                        .bookmarks
                        .iter()
                        .filter(|(_, id)| *id == article_id)
                        .count() as u32,
                }))
            }
        }
    }

    pub async fn unbookmark_article(
        &self,
        slug: &str,
        user_id: Uuid,
    ) -> Result<Option<SocialState>> {
        match self {
            Self::Postgres(service) => service.unbookmark_article(slug, user_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(article_id) = state.article_id_by_slug(slug) else {
                    return Ok(None);
                };
                state.bookmarks.remove(&(user_id, article_id));
                Ok(Some(SocialState {
                    active: false,
                    count: state
                        .bookmarks
                        .iter()
                        .filter(|(_, id)| *id == article_id)
                        .count() as u32,
                }))
            }
        }
    }

    pub async fn list_comments(&self, slug: &str) -> Result<Option<Vec<Comment>>> {
        match self {
            Self::Postgres(service) => service.list_comments(slug).await,
            Self::InMemory(state) => {
                let state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(article_id) = state.article_id_by_slug(slug) else {
                    return Ok(None);
                };
                Ok(Some(
                    state
                        .comments
                        .iter()
                        .filter(|comment| comment.article_id == article_id)
                        .cloned()
                        .collect(),
                ))
            }
        }
    }

    pub async fn create_comment(
        &self,
        slug: &str,
        author_id: Uuid,
        body: String,
        parent_id: Option<Uuid>,
    ) -> Result<Option<Comment>> {
        match self {
            Self::Postgres(service) => {
                service
                    .create_comment(slug, author_id, body, parent_id)
                    .await
            }
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(article_id) = state.article_id_by_slug(slug) else {
                    return Ok(None);
                };
                let now = Utc::now();
                let comment = Comment {
                    id: Uuid::new_v4(),
                    article_id,
                    author_id,
                    author_name: "Test Author".to_string(),
                    author_avatar_url: None,
                    body,
                    parent_id,
                    created_at: now,
                    updated_at: now,
                };
                state.comments.push(comment.clone());
                Ok(Some(comment))
            }
        }
    }

    pub async fn update_comment(
        &self,
        comment_id: Uuid,
        author_id: Uuid,
        body: String,
    ) -> Result<Option<Comment>> {
        match self {
            Self::Postgres(service) => service.update_comment(comment_id, author_id, body).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(comment) = state
                    .comments
                    .iter_mut()
                    .find(|comment| comment.id == comment_id && comment.author_id == author_id)
                else {
                    return Ok(None);
                };
                comment.body = body;
                comment.updated_at = Utc::now();
                Ok(Some(comment.clone()))
            }
        }
    }

    pub async fn delete_comment(&self, comment_id: Uuid, author_id: Uuid) -> Result<bool> {
        match self {
            Self::Postgres(service) => service.delete_comment(comment_id, author_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(index) = state
                    .comments
                    .iter()
                    .position(|comment| comment.id == comment_id && comment.author_id == author_id)
                else {
                    return Ok(false);
                };
                state.comments.remove(index);
                Ok(true)
            }
        }
    }

    pub async fn hide_comment(&self, comment_id: Uuid, moderator_id: Uuid) -> Result<bool> {
        match self {
            Self::Postgres(service) => service.hide_comment(comment_id, moderator_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(index) = state
                    .comments
                    .iter()
                    .position(|comment| comment.id == comment_id)
                else {
                    return Ok(false);
                };
                state.comments.remove(index);
                Ok(true)
            }
        }
    }

    pub async fn delete_comment_as_moderator(&self, comment_id: Uuid) -> Result<bool> {
        match self {
            Self::Postgres(service) => service.delete_comment_as_moderator(comment_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                let Some(index) = state
                    .comments
                    .iter()
                    .position(|comment| comment.id == comment_id)
                else {
                    return Ok(false);
                };
                state.comments.remove(index);
                Ok(true)
            }
        }
    }

    pub async fn follow_user(&self, follower_id: Uuid, following_id: Uuid) -> Result<SocialState> {
        match self {
            Self::Postgres(service) => service.follow_user(follower_id, following_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                if follower_id != following_id {
                    state.follows.insert((follower_id, following_id));
                }
                Ok(SocialState {
                    active: follower_id != following_id
                        && state.follows.contains(&(follower_id, following_id)),
                    count: state
                        .follows
                        .iter()
                        .filter(|(_, id)| *id == following_id)
                        .count() as u32,
                })
            }
        }
    }

    pub async fn unfollow_user(
        &self,
        follower_id: Uuid,
        following_id: Uuid,
    ) -> Result<SocialState> {
        match self {
            Self::Postgres(service) => service.unfollow_user(follower_id, following_id).await,
            Self::InMemory(state) => {
                let mut state = state.lock().expect("in-memory articles mutex poisoned");
                state.follows.remove(&(follower_id, following_id));
                Ok(SocialState {
                    active: false,
                    count: state
                        .follows
                        .iter()
                        .filter(|(_, id)| *id == following_id)
                        .count() as u32,
                })
            }
        }
    }

    pub async fn follow_state(
        &self,
        viewer_id: Option<Uuid>,
        following_id: Uuid,
    ) -> Result<SocialState> {
        match self {
            Self::Postgres(service) => service.follow_state(viewer_id, following_id).await,
            Self::InMemory(state) => {
                let state = state.lock().expect("in-memory articles mutex poisoned");
                let active = viewer_id.is_some_and(|viewer_id| {
                    viewer_id != following_id && state.follows.contains(&(viewer_id, following_id))
                });
                Ok(SocialState {
                    active,
                    count: state
                        .follows
                        .iter()
                        .filter(|(_, id)| *id == following_id)
                        .count() as u32,
                })
            }
        }
    }
}

#[derive(Debug, Default)]
pub struct InMemoryArticlesState {
    articles: Vec<Article>,
    likes: HashSet<(Uuid, Uuid)>,
    bookmarks: HashSet<(Uuid, Uuid)>,
    follows: HashSet<(Uuid, Uuid)>,
    comments: Vec<Comment>,
}

impl InMemoryArticlesState {
    fn article_id_by_slug(&self, slug: &str) -> Option<Uuid> {
        self.articles
            .iter()
            .find(|article| article.slug == slug)
            .map(|article| article.id)
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct UpdateArticle {
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub body: Option<String>,
    pub excerpt: Option<String>,
    pub content_gdoc_id: Option<Option<String>>,
    pub cover_image_url: Option<Option<String>>,
    pub category_name: Option<String>,
    pub tags: Option<Vec<String>>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SocialState {
    pub active: bool,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct ArticleSocialState {
    pub like: SocialState,
    pub bookmark: SocialState,
}

#[derive(Debug, Clone, Serialize)]
pub struct Comment {
    pub id: Uuid,
    pub article_id: Uuid,
    pub author_id: Uuid,
    pub author_name: String,
    pub author_avatar_url: Option<String>,
    pub body: String,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn article_preview_from_article(article: &Article) -> ArticlePreview {
    ArticlePreview {
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
        featured: false,
        cover_image_url: article.cover_image_url.clone(),
        preview_image_url: article.cover_image_url.clone(),
        category: article.category_detail.clone().unwrap_or_else(|| Category {
            name: article.category.clone(),
            color: category_color_hex(&article.category).to_string(),
        }),
        author: article.author_detail.clone().unwrap_or(Author {
            id: article.author_id,
            name: "Test Author".to_string(),
            avatar_url: None,
            username: None,
            headline: None,
            bio: None,
            articles_published: 0,
            total_views: 0,
        }),
        read_time_minutes: article.read_time_minutes,
    }
}

fn article_matches_filters(
    article: &Article,
    category: Option<&str>,
    search: Option<&str>,
    author: Option<Uuid>,
) -> bool {
    let matches_category = category.is_none_or(|category| {
        slug::slugify(&article.category) == category
            || article.category.eq_ignore_ascii_case(category)
    });
    let matches_author = author.is_none_or(|author| article.author_id == author);
    let matches_search = search
        .map(str::trim)
        .filter(|search| !search.is_empty())
        .is_none_or(|search| {
            let normalized = search.to_lowercase();
            article.title.to_lowercase().contains(&normalized)
                || article.excerpt.to_lowercase().contains(&normalized)
                || article.body.to_lowercase().contains(&normalized)
                || article
                    .author_detail
                    .as_ref()
                    .is_some_and(|author| author.name.to_lowercase().contains(&normalized))
        });

    matches_category && matches_author && matches_search
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
