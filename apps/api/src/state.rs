use std::sync::Arc;

use crate::{
    config::StorageProvider,
    services::{
        articles::ArticlesService, cache::CacheService, cloudinary::CloudinaryService,
        drive::DriveService,
    },
};

/// Shared application state for request handlers.
#[derive(Clone)]
pub struct AppState {
    pub articles: ArticlesService,
    pub drive: Option<Arc<DriveService>>,
    pub cloudinary: Option<Arc<CloudinaryService>>,
    pub storage_provider: StorageProvider,
    pub cache: Arc<CacheService>,
}
