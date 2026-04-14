//! Typed configuration loaded from environment variables.
//!
//! The API fails fast at startup when required integration variables are
//! missing or malformed.

use anyhow::{Context, Result, bail};
use std::env;

/// Application-wide configuration, parsed once at startup.
#[derive(Debug, Clone)]
pub struct AppConfig {
    /// Port to bind the HTTP server to.
    pub port: u16,
    /// Allowed CORS origin.
    pub frontend_url: String,
    /// Supabase project URL (used by auth middleware JWKS lookup).
    pub supabase_url: String,
    /// Supabase JWT secret (required by deployment contract).
    pub jwt_secret: String,
    /// Google Sheets spreadsheet ID for article storage.
    pub google_sheets_id: String,
    /// Google service account JSON key (as a raw string).
    pub google_service_account_json: String,
    /// Target folder for Drive uploads.
    pub google_drive_folder_id: String,
    /// Redis connection URL.
    pub redis_url: String,
    /// Redis auth token.
    pub redis_token: String,
}

impl AppConfig {
    /// Load and validate configuration from environment variables.
    pub fn from_env() -> Result<Self> {
        let port = env::var("PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse::<u16>()
            .context("PORT must be a valid u16")?;

        let frontend_url = required_env("NEXT_PUBLIC_FRONTEND_URL")?;
        let supabase_url = required_env("NEXT_PUBLIC_SUPABASE_URL")?;
        let jwt_secret = required_env("AXUM_JWT_SECRET")?;
        let google_sheets_id = required_env("GOOGLE_SHEETS_ID")?;
        let google_service_account_json = required_env("GOOGLE_SERVICE_ACCOUNT_JSON")?;
        let google_drive_folder_id = required_env("GOOGLE_DRIVE_FOLDER_ID")?;
        let redis_url = required_env("UPSTASH_REDIS_URL")?;
        let redis_token = required_env("UPSTASH_REDIS_TOKEN")?;

        Ok(Self {
            port,
            frontend_url,
            supabase_url,
            jwt_secret,
            google_sheets_id,
            google_service_account_json,
            google_drive_folder_id,
            redis_url,
            redis_token,
        })
    }
}

fn required_env(key: &str) -> Result<String> {
    let value = env::var(key).with_context(|| format!("Missing required env var: {key}"))?;
    if value.trim().is_empty() {
        bail!("Environment variable '{key}' cannot be empty");
    }
    Ok(value)
}
