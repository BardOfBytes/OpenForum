//! Google Drive file upload service.

use anyhow::{Context, Result, bail};
use chrono::Utc;
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const SCOPE_DRIVE_FILE: &str = "https://www.googleapis.com/auth/drive.file";
const MAX_FILE_SIZE: usize = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp"];

#[derive(Deserialize, Debug)]
struct ServiceAccountJson {
    client_email: String,
    private_key: String,
}

#[derive(Serialize)]
struct GoogleTokenClaims {
    iss: String,
    scope: String,
    aud: String,
    exp: usize,
    iat: usize,
}

#[derive(Deserialize, Debug)]
struct GoogleTokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Debug, Clone)]
struct CachedToken {
    token: String,
    expires_at: Instant,
}

/// Google Drive upload service.
#[derive(Debug, Clone)]
pub struct DriveService {
    folder_id: String,
    client: reqwest::Client,
    service_email: String,
    private_key: String,
    cached_token: Arc<RwLock<Option<CachedToken>>>,
    test_mode: bool,
}

/// Result of a successful file upload.
#[derive(Debug)]
pub struct UploadResult {
    pub file_id: String,
    pub public_url: String,
}

#[derive(Deserialize)]
struct CreateFileResponse {
    id: String,
}

impl DriveService {
    /// Create a new DriveService.
    pub fn new(folder_id: String, service_account_json: String) -> Result<Self> {
        let service_account: ServiceAccountJson = serde_json::from_str(&service_account_json)
            .context("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON for Drive service")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            folder_id,
            client,
            service_email: service_account.client_email,
            private_key: service_account.private_key,
            cached_token: Arc::new(RwLock::new(None)),
            test_mode: false,
        })
    }

    pub fn for_tests() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(1))
            .build()
            .expect("Failed to create test HTTP client");

        Self {
            folder_id: "test-folder".to_string(),
            client,
            service_email: "test@example.com".to_string(),
            private_key: "test".to_string(),
            cached_token: Arc::new(RwLock::new(Some(CachedToken {
                token: "test".to_string(),
                expires_at: Instant::now() + Duration::from_secs(3600),
            }))),
            test_mode: true,
        }
    }

    async fn get_access_token(&self) -> Result<String> {
        {
            let guard = self.cached_token.read().await;
            if let Some(ref cached) = *guard
                && cached.expires_at > Instant::now() + Duration::from_secs(60)
            {
                return Ok(cached.token.clone());
            }
        }

        let mut guard = self.cached_token.write().await;
        if let Some(ref cached) = *guard
            && cached.expires_at > Instant::now() + Duration::from_secs(60)
        {
            return Ok(cached.token.clone());
        }

        let now = Utc::now().timestamp() as usize;
        let claims = GoogleTokenClaims {
            iss: self.service_email.clone(),
            scope: SCOPE_DRIVE_FILE.to_string(),
            aud: TOKEN_URL.to_string(),
            iat: now,
            exp: now + 3500,
        };

        let encoding_key = EncodingKey::from_rsa_pem(self.private_key.as_bytes())
            .context("Invalid Drive service account private key format")?;
        let jwt = encode(&Header::new(Algorithm::RS256), &claims, &encoding_key)
            .context("Failed to sign Drive auth JWT")?;

        let params = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &jwt),
        ];

        let response: GoogleTokenResponse = self
            .client
            .post(TOKEN_URL)
            .form(&params)
            .send()
            .await
            .context("Network error requesting Google Drive access token")?
            .error_for_status()
            .context("Google OAuth API returned an error for Drive scope")?
            .json()
            .await
            .context("Failed to parse Google OAuth response for Drive scope")?;

        let expires_at = Instant::now() + Duration::from_secs(response.expires_in);
        *guard = Some(CachedToken {
            token: response.access_token.clone(),
            expires_at,
        });

        Ok(response.access_token)
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
                public_url: format!("https://drive.google.com/uc?export=view&id={file_id}"),
                file_id,
            });
        }

        let token = self.get_access_token().await?;
        let metadata = serde_json::json!({
            "name": filename,
            "parents": [self.folder_id],
            "mimeType": mime_type,
        });

        let create_response = self
            .client
            .post("https://www.googleapis.com/drive/v3/files?fields=id")
            .bearer_auth(&token)
            .json(&metadata)
            .send()
            .await
            .context("Google Drive create-file request failed")?;

        if !create_response.status().is_success() {
            let status = create_response.status();
            let error_body = create_response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Google Drive create-file returned HTTP {status}: {error_body}");
        }

        let create_response: CreateFileResponse = create_response
            .json()
            .await
            .context("Failed to parse Google Drive create-file response")?;

        let upload_url = format!(
            "https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media",
            create_response.id
        );
        let upload_response = self
            .client
            .patch(&upload_url)
            .bearer_auth(&token)
            .header("Content-Type", mime_type)
            .body(data.to_vec())
            .send()
            .await
            .context("Google Drive media upload request failed")?;

        if !upload_response.status().is_success() {
            let status = upload_response.status();
            let error_body = upload_response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Google Drive media upload returned HTTP {status}: {error_body}");
        }

        let permissions_url = format!(
            "https://www.googleapis.com/drive/v3/files/{}/permissions",
            create_response.id
        );
        let permissions_body = serde_json::json!({
            "role": "reader",
            "type": "anyone",
        });
        let permissions_response = self
            .client
            .post(&permissions_url)
            .bearer_auth(&token)
            .json(&permissions_body)
            .send()
            .await
            .context("Google Drive permission request failed")?;

        if !permissions_response.status().is_success() {
            let status = permissions_response.status();
            let error_body = permissions_response
                .text()
                .await
                .unwrap_or_else(|_| "<unavailable>".to_string());
            bail!("Google Drive permission request returned HTTP {status}: {error_body}");
        }

        Ok(UploadResult {
            public_url: format!(
                "https://drive.google.com/uc?export=view&id={}",
                create_response.id
            ),
            file_id: create_response.id,
        })
    }
}
