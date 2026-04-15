//! Cloudinary image upload service.

use anyhow::{Context, Result, bail};
use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use sha1::{Digest, Sha1};
use std::time::Duration;

const MAX_FILE_SIZE: usize = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp"];

/// Cloudinary upload service.
#[derive(Debug, Clone)]
pub struct CloudinaryService {
    client: reqwest::Client,
    cloud_name: String,
    api_key: String,
    api_secret: String,
    upload_folder: Option<String>,
    test_mode: bool,
}

/// Result of a successful file upload.
#[derive(Debug)]
pub struct UploadResult {
    pub file_id: String,
    pub public_url: String,
}

#[derive(Deserialize)]
struct CloudinaryUploadResponse {
    public_id: String,
    secure_url: String,
}

impl CloudinaryService {
    /// Create a new CloudinaryService.
    pub fn new(
        cloud_name: String,
        api_key: String,
        api_secret: String,
        upload_folder: Option<String>,
    ) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            client,
            cloud_name,
            api_key,
            api_secret,
            upload_folder: upload_folder.filter(|value| !value.trim().is_empty()),
            test_mode: false,
        })
    }

    pub fn for_tests() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(1))
            .build()
            .expect("Failed to create test HTTP client");

        Self {
            client,
            cloud_name: "test".to_string(),
            api_key: "test".to_string(),
            api_secret: "test".to_string(),
            upload_folder: Some("tests".to_string()),
            test_mode: true,
        }
    }

    pub async fn upload_file(
        &self,
        filename: &str,
        mime_type: &str,
        data: &[u8],
    ) -> Result<UploadResult> {
        if !ALLOWED_MIME_TYPES.contains(&mime_type) {
            bail!(
                "Invalid file type '{}'. Allowed: {}",
                mime_type,
                ALLOWED_MIME_TYPES.join(", ")
            );
        }

        if data.len() > MAX_FILE_SIZE {
            bail!(
                "File too large ({} bytes). Maximum: {} bytes",
                data.len(),
                MAX_FILE_SIZE
            );
        }

        if self.test_mode {
            let file_id = format!("test-{}", uuid::Uuid::new_v4());
            return Ok(UploadResult {
                file_id: file_id.clone(),
                public_url: format!(
                    "https://res.cloudinary.com/{}/image/upload/{file_id}",
                    self.cloud_name
                ),
            });
        }

        let timestamp = chrono::Utc::now().timestamp();
        let signature = self.signature(timestamp);

        let url = format!(
            "https://api.cloudinary.com/v1_1/{}/image/upload",
            self.cloud_name
        );

        let mut form = Form::new()
            .text("api_key", self.api_key.clone())
            .text("timestamp", timestamp.to_string())
            .text("signature", signature);

        if let Some(folder) = self.upload_folder.as_ref() {
            form = form.text("folder", folder.clone());
        }

        let part = Part::bytes(data.to_vec())
            .file_name(filename.to_string())
            .mime_str(mime_type)
            .context("Failed to build multipart file part")?;
        form = form.part("file", part);

        let response = self
            .client
            .post(url)
            .multipart(form)
            .send()
            .await
            .context("Cloudinary upload request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Cloudinary upload returned HTTP {status}: {error_body}");
        }

        let uploaded: CloudinaryUploadResponse = response
            .json()
            .await
            .context("Failed to parse Cloudinary upload response")?;

        Ok(UploadResult {
            file_id: uploaded.public_id,
            public_url: uploaded.secure_url,
        })
    }

    fn signature(&self, timestamp: i64) -> String {
        let mut params = vec![("timestamp", timestamp.to_string())];

        if let Some(folder) = self.upload_folder.as_ref() {
            params.push(("folder", folder.clone()));
        }

        params.sort_by(|(left, _), (right, _)| left.cmp(right));

        let base = params
            .iter()
            .map(|(key, value)| format!("{key}={value}"))
            .collect::<Vec<_>>()
            .join("&");

        let to_sign = format!("{base}{}", self.api_secret);
        let mut hasher = Sha1::new();
        hasher.update(to_sign.as_bytes());
        hex::encode(hasher.finalize())
    }
}
