//! Typed configuration loaded from environment variables.
//!
//! The API fails fast at startup when required integration variables are
//! missing or malformed.

use anyhow::{Context, Result, bail};
use std::env;

#[derive(Debug, Clone)]
pub struct CloudinaryConfig {
    pub cloud_name: String,
    pub api_key: String,
    pub api_secret: String,
    pub upload_folder: Option<String>,
}

/// Application-wide configuration, parsed once at startup.
#[derive(Debug, Clone)]
pub struct AppConfig {
    /// Port to bind the HTTP server to.
    pub port: u16,
    /// Allowed CORS origin.
    pub frontend_url: String,
    /// Supabase project URL (used by auth middleware JWKS lookup).
    pub supabase_url: String,
    /// Supabase/Postgres connection string.
    pub database_url: String,
    /// Cloudinary configuration.
    pub cloudinary: CloudinaryConfig,
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
        let database_url = required_env("DATABASE_URL")?;
        let cloudinary = CloudinaryConfig {
            cloud_name: required_env("CLOUDINARY_CLOUD_NAME")?,
            api_key: required_env("CLOUDINARY_API_KEY")?,
            api_secret: required_env("CLOUDINARY_API_SECRET")?,
            upload_folder: optional_env("CLOUDINARY_UPLOAD_FOLDER"),
        };

        let redis_url =
            required_env_with_fallback(&["UPSTASH_REDIS_URL", "UPSTASH_REDIS_REST_URL"])?;
        let redis_token =
            required_env_with_fallback(&["UPSTASH_REDIS_TOKEN", "UPSTASH_REDIS_REST_TOKEN"])?;

        Ok(Self {
            port,
            frontend_url,
            supabase_url,
            database_url,
            cloudinary,
            redis_url,
            redis_token,
        })
    }
}

fn optional_env(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn required_env(key: &str) -> Result<String> {
    let value = env::var(key).with_context(|| format!("Missing required env var: {key}"))?;
    if value.trim().is_empty() {
        bail!("Environment variable '{key}' cannot be empty");
    }
    Ok(value)
}

fn required_env_with_fallback(keys: &[&str]) -> Result<String> {
    for key in keys {
        if let Ok(value) = env::var(key)
            && !value.trim().is_empty()
        {
            return Ok(value);
        }
    }

    bail!("Missing required env var. Set one of: {}", keys.join(", "))
}
