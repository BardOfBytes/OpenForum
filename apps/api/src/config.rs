//! Typed configuration loaded from environment variables.
//!
//! The API fails fast at startup when required integration variables are
//! missing or malformed.

use anyhow::{Context, Result, bail};
use std::env;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageProvider {
    Drive,
    Cloudinary,
}

impl StorageProvider {
    pub fn from_env() -> Result<Self> {
        let raw = env::var("STORAGE_PROVIDER").unwrap_or_else(|_| "drive".to_string());
        let normalized = raw.trim().to_ascii_lowercase();

        match normalized.as_str() {
            "drive" | "google_drive" | "google-drive" | "gdrive" => Ok(Self::Drive),
            "cloudinary" => Ok(Self::Cloudinary),
            _ => bail!(
                "Invalid STORAGE_PROVIDER '{raw}'. Supported values: drive, cloudinary"
            ),
        }
    }
}

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
    /// Google Sheets spreadsheet ID for article storage.
    pub google_sheets_id: String,
    /// Google service account JSON key (as a raw string).
    pub google_service_account_json: String,
    /// Target folder for Drive uploads.
    pub google_drive_folder_id: Option<String>,
    /// Which storage backend to use for uploads.
    pub storage_provider: StorageProvider,
    /// Cloudinary configuration (required when STORAGE_PROVIDER=cloudinary).
    pub cloudinary: Option<CloudinaryConfig>,
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

        let storage_provider = StorageProvider::from_env()?;
        let frontend_url = required_env("NEXT_PUBLIC_FRONTEND_URL")?;
        let supabase_url = required_env("NEXT_PUBLIC_SUPABASE_URL")?;
        let google_sheets_id = required_env("GOOGLE_SHEETS_ID")?;
        let google_service_account_json = required_env("GOOGLE_SERVICE_ACCOUNT_JSON")?;

        let google_drive_folder_id = match storage_provider {
            StorageProvider::Drive => Some(required_env("GOOGLE_DRIVE_FOLDER_ID")?),
            StorageProvider::Cloudinary => optional_env("GOOGLE_DRIVE_FOLDER_ID"),
        };

        let cloudinary = match storage_provider {
            StorageProvider::Cloudinary => Some(CloudinaryConfig {
                cloud_name: required_env("CLOUDINARY_CLOUD_NAME")?,
                api_key: required_env("CLOUDINARY_API_KEY")?,
                api_secret: required_env("CLOUDINARY_API_SECRET")?,
                upload_folder: optional_env("CLOUDINARY_UPLOAD_FOLDER"),
            }),
            StorageProvider::Drive => None,
        };

        let redis_url =
            required_env_with_fallback(&["UPSTASH_REDIS_URL", "UPSTASH_REDIS_REST_URL"])?;
        let redis_token =
            required_env_with_fallback(&["UPSTASH_REDIS_TOKEN", "UPSTASH_REDIS_REST_TOKEN"])?;

        Ok(Self {
            port,
            frontend_url,
            supabase_url,
            google_sheets_id,
            google_service_account_json,
            google_drive_folder_id,
            storage_provider,
            cloudinary,
            redis_url,
            redis_token,
        })
    }
}

fn optional_env(key: &str) -> Option<String> {
    env::var(key).ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
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
