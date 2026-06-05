//! OpenForum API binary entrypoint.

use std::sync::Arc;

use anyhow::Context;
use openforum_api::{
    build_app,
    config::AppConfig,
    services::{
        articles::ArticlesService, articles_postgres::PostgresArticlesService, cache::CacheService,
        cloudinary::CloudinaryService,
    },
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

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
        .context("Failed to connect to Postgres")?;

    sqlx::migrate!()
        .run(&pool)
        .await
        .context("Failed to run Postgres migrations")?;

    let articles = ArticlesService::postgres(PostgresArticlesService::new(pool, cache.clone()));

    let cloudinary = CloudinaryService::new(
        config.cloudinary.cloud_name.clone(),
        config.cloudinary.api_key.clone(),
        config.cloudinary.api_secret.clone(),
        config.cloudinary.upload_folder.clone(),
    )
    .context("Failed to initialize Cloudinary service")?;

    let state = AppState {
        articles,
        cloudinary: Arc::new(cloudinary),
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
