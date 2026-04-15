//! Image upload routes.

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Multipart, State},
    http::StatusCode,
    routing::post,
};
use serde::Serialize;

use crate::{config::StorageProvider, middleware::auth::AuthUser, state::AppState};

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub file_id: String,
    pub public_url: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: &'static str,
    pub message: String,
}

fn infer_mime_type_from_filename(filename: &str) -> Option<&'static str> {
    let extension = filename.rsplit('.').next()?.to_ascii_lowercase();
    match extension.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

fn map_upstream_upload_error(provider: StorageProvider, message: &str) -> &'static str {
    match provider {
        StorageProvider::Drive => {
            if message.contains("storageQuotaExceeded")
                || message.contains("Service Accounts do not have storage quota")
            {
                return "Google Drive rejected this upload because service accounts have no personal storage quota. Use a folder inside a Shared Drive and grant the service account Content manager access.";
            }

            if message.contains("must point to a folder inside a Shared Drive")
                || message.contains("not in a Shared Drive")
            {
                return "GOOGLE_DRIVE_FOLDER_ID must be a folder inside a Shared Drive. Do not use a personal My Drive folder link.";
            }

            if message.contains("cannot upload to Shared Drive folder") {
                return "Service account lacks upload permission on the Shared Drive folder. Add it as Content manager on the Shared Drive.";
            }

            if message.contains("upload folder '")
                && message.contains("was not found or is not accessible")
            {
                return "Drive folder not found or inaccessible to the service account. Verify GOOGLE_DRIVE_FOLDER_ID is correct and add the service account as Content manager on the Shared Drive.";
            }

            if message.contains("folder metadata access") {
                return "Drive folder access denied. Add the service account as Content manager on the Shared Drive that contains GOOGLE_DRIVE_FOLDER_ID.";
            }

            if message.contains("folder metadata returned HTTP 404") {
                return "Drive folder not found. Verify GOOGLE_DRIVE_FOLDER_ID in backend environment variables.";
            }

            if message.contains("folder metadata returned HTTP 403") {
                return "Drive folder access denied. Add the service account as Content manager on the Shared Drive and verify GOOGLE_DRIVE_FOLDER_ID points to a folder in that drive.";
            }

            if message.contains("create-file returned HTTP 404") {
                return "Drive folder not found. Verify GOOGLE_DRIVE_FOLDER_ID in backend environment variables.";
            }

            if message.contains("create-file returned HTTP 403") {
                return "Drive write access denied. Add the service account as Content manager on the Shared Drive and verify GOOGLE_DRIVE_FOLDER_ID points to a folder in that drive.";
            }

            if message.contains("permission request returned HTTP 403") {
                return "Drive upload succeeded, but Google denied public sharing. Check Workspace sharing policy or use a personal Drive folder.";
            }

            if message.contains("Google OAuth API returned an error") {
                return "Google Drive authentication failed. Verify GOOGLE_SERVICE_ACCOUNT_JSON in backend environment variables.";
            }

            if message.contains("Network error requesting Google Drive access token")
                || message.contains("Google Drive create-file request failed")
                || message.contains("Google Drive media upload request failed")
                || message.contains("Google Drive permission request failed")
            {
                return "Unable to reach Google Drive API right now. Try again in a moment.";
            }

            "Image upload failed due to upstream storage error"
        }
        StorageProvider::Cloudinary => {
            if message.contains("Cloudinary upload returned HTTP 400") {
                return "Cloudinary rejected this upload request. Verify CLOUDINARY_* environment variables and try again.";
            }

            if message.contains("Cloudinary upload returned HTTP 401")
                || message.contains("Cloudinary upload returned HTTP 403")
                || message.contains("Cloudinary upload returned HTTP 404")
            {
                return "Cloudinary rejected the API credentials or cloud name. Verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the backend environment (Render).";
            }

            if message.contains("Cloudinary upload request failed") {
                return "Unable to reach Cloudinary API right now. Try again in a moment.";
            }

            "Image upload failed due to upstream storage error"
        }
    }
}

fn is_upload_configuration_error(provider: StorageProvider, message: &str) -> bool {
    match provider {
        StorageProvider::Drive => {
            message.contains("must point to a folder inside a Shared Drive")
                || message.contains("not in a Shared Drive")
                || message.contains("cannot upload to Shared Drive folder")
                || message.contains("upload folder '")
                || message.contains("folder metadata access")
                || message.contains("folder metadata returned HTTP 404")
                || message.contains("folder metadata returned HTTP 403")
                || message.contains("create-file returned HTTP 404")
                || message.contains("create-file returned HTTP 403")
                || message.contains("Google OAuth API returned an error")
        }
        StorageProvider::Cloudinary => {
            message.contains("Cloudinary upload returned HTTP 400")
                || message.contains("Cloudinary upload returned HTTP 401")
                || message.contains("Cloudinary upload returned HTTP 403")
                || message.contains("Cloudinary upload returned HTTP 404")
        }
    }
}

async fn upload_image(
    State(state): State<AppState>,
    _user: AuthUser,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadResponse>), (StatusCode, Json<ErrorResponse>)> {
    let provider = state.storage_provider;

    while let Some(field) = multipart.next_field().await.map_err(|error| {
        tracing::warn!(error = %error, "Failed to parse multipart upload payload");
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid_multipart",
                message: format!("Failed to parse multipart form data: {error}"),
            }),
        )
    })? {
        if field.name() != Some("file") {
            continue;
        }

        let filename = field.file_name().unwrap_or("upload.bin").to_string();
        let mime_type = field
            .content_type()
            .map(str::to_string)
            .or_else(|| infer_mime_type_from_filename(&filename).map(str::to_string))
            .ok_or_else(|| {
                tracing::warn!(filename = %filename, "Upload rejected due to missing/unsupported MIME type");
                (
                    StatusCode::UNSUPPORTED_MEDIA_TYPE,
                    Json(ErrorResponse {
                        error: "missing_mime_type",
                        message:
                            "Uploaded file is missing Content-Type and file extension is not supported"
                                .to_string(),
                    }),
                )
            })?;

        let bytes = field.bytes().await.map_err(|error| {
            tracing::warn!(error = %error, filename = %filename, "Failed to read upload bytes");
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "invalid_file",
                    message: format!("Failed to read uploaded file bytes: {error}"),
                }),
            )
        })?;

        let upload_result = match provider {
            StorageProvider::Drive => {
                let drive = state.drive.as_ref().ok_or_else(|| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(ErrorResponse {
                            error: "upload_unavailable",
                            message:
                                "Drive upload is not configured on this deployment".to_string(),
                        }),
                    )
                })?;

                drive
                    .upload_file(&filename, &mime_type, bytes.as_ref())
                    .await
                    .map(|uploaded| (uploaded.file_id, uploaded.public_url))
            }
            StorageProvider::Cloudinary => {
                let cloudinary = state.cloudinary.as_ref().ok_or_else(|| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(ErrorResponse {
                            error: "upload_unavailable",
                            message: "Cloudinary upload is not configured on this deployment"
                                .to_string(),
                        }),
                    )
                })?;

                cloudinary
                    .upload_file(&filename, &mime_type, bytes.as_ref())
                    .await
                    .map(|uploaded| (uploaded.file_id, uploaded.public_url))
            }
        };

        let (file_id, public_url) = upload_result.map_err(|error| {
            let message = error.to_string();
            tracing::warn!(
                error = %message,
                filename = %filename,
                mime_type = %mime_type,
                provider = ?provider,
                "Upload failed"
            );
            if message.contains("Invalid file type") {
                (
                    StatusCode::UNSUPPORTED_MEDIA_TYPE,
                    Json(ErrorResponse {
                        error: "invalid_mime_type",
                        message,
                    }),
                )
            } else if message.contains("File too large") {
                (
                    StatusCode::PAYLOAD_TOO_LARGE,
                    Json(ErrorResponse {
                        error: "payload_too_large",
                        message,
                    }),
                )
            } else {
                let status = if is_upload_configuration_error(provider, &message) {
                    StatusCode::INTERNAL_SERVER_ERROR
                } else {
                    StatusCode::BAD_GATEWAY
                };

                (
                    status,
                    Json(ErrorResponse {
                        error: "upload_failed",
                        message: map_upstream_upload_error(provider, &message).to_string(),
                    }),
                )
            }
        })?;

        return Ok((
            StatusCode::CREATED,
            Json(UploadResponse {
                file_id,
                public_url,
            }),
        ));
    }

    Err((
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse {
            error: "missing_file",
            message: "No multipart field named 'file' was provided".to_string(),
        }),
    ))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/upload", post(upload_image))
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024))
}
