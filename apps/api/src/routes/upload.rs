//! Image upload routes.

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Multipart, State},
    http::StatusCode,
    routing::post,
};
use serde::Serialize;

use crate::{middleware::auth::AuthUser, state::AppState};

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

fn map_upstream_upload_error(message: &str) -> &'static str {
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

async fn upload_image(
    State(state): State<AppState>,
    _user: AuthUser,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadResponse>), (StatusCode, Json<ErrorResponse>)> {
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

        let uploaded = state
            .drive
            .upload_file(&filename, &mime_type, bytes.as_ref())
            .await
            .map_err(|error| {
                let message = error.to_string();
                tracing::warn!(
                    error = %message,
                    filename = %filename,
                    mime_type = %mime_type,
                    "Drive upload failed"
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
                    (
                        StatusCode::BAD_GATEWAY,
                        Json(ErrorResponse {
                            error: "upload_failed",
                            message: map_upstream_upload_error(&message).to_string(),
                        }),
                    )
                }
            })?;

        return Ok((
            StatusCode::CREATED,
            Json(UploadResponse {
                file_id: uploaded.file_id,
                public_url: uploaded.public_url,
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
