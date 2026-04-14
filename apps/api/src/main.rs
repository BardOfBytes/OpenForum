//! OpenForum API binary entrypoint.

use std::sync::Arc;

use anyhow::Context;
use openforum_api::{
    build_app,
    config::AppConfig,
    services::{cache::CacheService, drive::DriveService, sheets::SheetsService},
    state::AppState,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "openforum_api=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config =
        AppConfig::from_env().context("API startup failed: invalid or missing configuration")?;
    tracing::info!(
        port = config.port,
        frontend = %config.frontend_url,
        "Configuration loaded"
    );

    let cache = CacheService::new(config.redis_url.clone(), config.redis_token.clone())
        .context("Failed to initialize Redis cache service")?;
    let sheets = SheetsService::new(
        config.google_sheets_id.clone(),
        config.google_service_account_json.clone(),
        cache.clone(),
    )
    .context("Failed to initialize Google Sheets service")?;
    let drive = DriveService::new(
        config.google_drive_folder_id.clone(),
        config.google_service_account_json.clone(),
    )
    .context("Failed to initialize Google Drive service")?;

    let state = AppState {
        sheets: Arc::new(sheets),
        drive: Arc::new(drive),
        cache: Arc::new(cache),
    };
    let app = build_app(&config, state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("OpenForum API listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("Failed to bind TCP listener on {addr}"))?;
    axum::serve(listener, app)
        .await
        .context("Axum server failed")?;

    Ok(())
}
