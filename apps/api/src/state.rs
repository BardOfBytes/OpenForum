use std::sync::Arc;

use crate::services::{
    articles::ArticlesService, cache::CacheService, cloudinary::CloudinaryService,
};

/// Shared application state for request handlers.
#[derive(Clone)]
pub struct AppState {
    pub articles: ArticlesService,
    pub cloudinary: Arc<CloudinaryService>,
    pub cache: Arc<CacheService>,
}
