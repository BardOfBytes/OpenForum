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
    let configured_frontend_origin = config.frontend_url.clone();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(move |origin, _request_parts| {
            origin
                .to_str()
                .map(|value| is_allowed_origin(value, &configured_frontend_origin))
                .unwrap_or(false)
        }))
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

fn is_allowed_origin(origin: &str, configured_frontend_origin: &str) -> bool {
    let normalized_origin = origin.trim_end_matches('/').to_ascii_lowercase();
    let normalized_configured = configured_frontend_origin
        .trim_end_matches('/')
        .to_ascii_lowercase();

    if normalized_origin == normalized_configured {
        return true;
    }

    if normalized_origin == "http://localhost:3000" || normalized_origin == "http://127.0.0.1:3000"
    {
        return true;
    }

    normalized_origin.starts_with("https://") && normalized_origin.ends_with(".vercel.app")
}
