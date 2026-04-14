//! Health check routes.

use axum::{Json, Router, routing::get};
use serde::Serialize;

use crate::state::AppState;

/// Health check response payload.
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub service: &'static str,
}

/// `GET /health` — returns API status and version.
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
        service: "openforum-api",
    })
}

/// Mount health routes onto a router.
pub fn router() -> Router<AppState> {
    Router::new().route("/health", get(health_check))
}
