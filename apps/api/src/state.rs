use std::sync::Arc;

use crate::{
    config::StorageProvider,
    services::{
        cache::CacheService, cloudinary::CloudinaryService, drive::DriveService,
        sheets::SheetsService,
    },
};

/// Shared application state for request handlers.
#[derive(Clone)]
pub struct AppState {
    pub sheets: Arc<SheetsService>,
    pub drive: Option<Arc<DriveService>>,
    pub cloudinary: Option<Arc<CloudinaryService>>,
    pub storage_provider: StorageProvider,
    pub cache: Arc<CacheService>,
}
