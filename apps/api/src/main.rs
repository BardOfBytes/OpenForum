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
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use std::str::FromStr;
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

    let mut connect_options = PgConnectOptions::from_str(&config.database_url)
        .context("Failed to parse Postgres DATABASE_URL")?;

    // Detect a transaction-pooling proxy (Supabase Supavisor / PgBouncer).
    // Such poolers multiplex many client sessions over a small set of server
    // connections, so server-side prepared statements cached by sqlx get
    // cross-wired between queries — producing "invalid length"/"no rows"
    // decode errors. Disabling the statement cache makes sqlx send each query
    // without a persistent prepared statement, which is pooler-safe.
    let url = config.database_url.as_str();
    let uses_pooler = url.contains("pooler.supabase.com")
        || url.contains("supabase.co:6543")
        || url.contains(":6543")
        || url.contains("pgbouncer=true");

    if uses_pooler {
        connect_options = connect_options.statement_cache_capacity(0);
    }

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await
        .context("Failed to connect to Postgres")?;

    if config.run_api_migrations {
        sqlx::migrate!()
            .run(&pool)
            .await
            .context("Failed to run Postgres migrations")?;
    } else {
        tracing::info!("Skipping API-owned SQL migrations; schema is managed externally");
    }

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
