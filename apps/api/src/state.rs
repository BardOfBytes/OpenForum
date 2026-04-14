use std::sync::Arc;

use crate::services::{cache::CacheService, drive::DriveService, sheets::SheetsService};

/// Shared application state for request handlers.
#[derive(Clone)]
pub struct AppState {
    pub sheets: Arc<SheetsService>,
    pub drive: Arc<DriveService>,
    pub cache: Arc<CacheService>,
}
