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

    // Redis is optional. If it is unconfigured or its URL is malformed, run
    // with caching and rate limiting disabled rather than refusing to boot —
    // a dead cache should degrade performance, not take the site down.
    let cache = match config.redis_url.clone() {
        Some(url) => {
            let token = config.redis_token.clone().unwrap_or_default();
            match CacheService::new(url, token) {
                Ok(cache) => {
                    tracing::info!("Redis cache enabled");
                    cache
                }
                Err(error) => {
                    tracing::warn!(
                        error = %error,
                        "Redis URL is invalid; continuing with caching and rate limiting disabled"
                    );
                    CacheService::disabled()
                }
            }
        }
        None => {
            tracing::warn!(
                "No UPSTASH_REDIS_URL configured; caching and rate limiting are disabled"
            );
            CacheService::disabled()
        }
    };

    let mut connect_options = PgConnectOptions::from_str(&config.database_url)
        .context("Failed to parse Postgres DATABASE_URL")?;

    // Disable sqlx's prepared-statement cache unconditionally.
    //
    // A transaction-pooling proxy (Supabase Supavisor / PgBouncer) multiplexes
    // many client sessions over few server connections, so cached prepared
    // statements get cross-wired between queries. The symptom is that any
    // endpoint issuing two queries concurrently fails intermittently with
    // "supplies N parameters, but prepared statement requires M" or
    // "invalid length: expected 16 bytes, found 8".
    //
    // This used to be gated on sniffing DATABASE_URL for pooler markers, which
    // is fragile: a deployment whose URL did not match the patterns silently
    // kept the cache and broke in production. Both `tokio::join!` endpoints
    // (/api/v1/articles and /api/v1/users/{id}/articles) were returning 502 on
    // roughly 80% of requests while every single-query endpoint stayed healthy
    // — the signature of exactly this bug.
    //
    // Making it unconditional costs nothing: every query in
    // services/articles_postgres.rs already sets `.persistent(false)`, so the
    // cache was never populated on purpose in the first place. Set
    // OPENFORUM_PG_STATEMENT_CACHE=<n> to re-enable it on a direct
    // (non-pooled) connection.
    let statement_cache_capacity = std::env::var("OPENFORUM_PG_STATEMENT_CACHE")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(0);

    connect_options = connect_options.statement_cache_capacity(statement_cache_capacity);
    tracing::info!(
        statement_cache_capacity,
        "Postgres statement cache configured (0 = pooler-safe)"
    );

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
