//! OpenForum API library crate.

pub mod config;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod services;
pub mod state;

use axum::Router;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::AppConfig;
use crate::state::AppState;

/// Build the full Axum application router.
pub fn build_app(config: &AppConfig, state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .frontend_url
                .parse::<axum::http::HeaderValue>()
                .map(AllowOrigin::exact)
                .unwrap_or_else(|_| {
                    tracing::warn!("Invalid CORS origin, falling back to permissive");
                    AllowOrigin::any()
                }),
        )
        .allow_methods(AllowMethods::any())
        .allow_headers(AllowHeaders::any());

    let api_v1 = Router::new()
        .merge(routes::articles::router())
        .merge(routes::users::router())
        .merge(routes::upload::router());

    Router::new()
        .merge(routes::health::router())
        .nest("/api/v1", api_v1)
        .with_state(state)
        .layer(CompressionLayer::new())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
