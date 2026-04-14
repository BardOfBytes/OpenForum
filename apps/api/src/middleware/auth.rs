//! JWT authentication extractor with Supabase JWKS validation.
//!
//! Validates Supabase-issued JWTs using RS256 signature verification
//! against the project's JWKS (JSON Web Key Set) endpoint. The JWKS
//! is cached in memory with a 1-hour TTL to minimize network calls.
//! For local/integration testing, HS256 tokens signed with
//! `AXUM_JWT_SECRET` are also accepted.
//!
//! # Usage
//!
//! Add `AuthUser` as an extractor parameter to any protected handler:
//!
//! ```rust
//! use crate::middleware::auth::AuthUser;
//!
//! async fn protected_handler(user: AuthUser) -> impl IntoResponse {
//!     format!("Hello {} ({})", user.email, user.role)
//! }
//! ```
//!
//! # Security Layers
//!
//! 1. RS256 signature validation against Supabase JWKS (or HS256 with local secret)
//! 2. Token expiry check (built into `jsonwebtoken`)
//! 3. Audience validation (`authenticated`)
//! 4. Email domain restriction (`@csvtu.ac.in`)

use axum::{
    Json,
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
    response::{IntoResponse, Response},
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header, jwk::JwkSet};
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use uuid::Uuid;

// ── Constants ───────────────────────────────────────────────────

/// How long to cache the JWKS before refetching (1 hour).
const JWKS_CACHE_TTL: Duration = Duration::from_secs(3600);

/// Allowed email domain suffix.
const ALLOWED_DOMAIN: &str = "@csvtu.ac.in";

// ── JWKS Cache ──────────────────────────────────────────────────

/// In-memory JWKS cache with TTL, shared across all requests.
static JWKS_CACHE: LazyLock<Mutex<Option<CachedJwks>>> = LazyLock::new(|| Mutex::new(None));

/// Global reqwest client for JWKS fetching (reuses connections).
static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client for JWKS")
});

/// Cached JWKS keys with their fetch timestamp.
#[derive(Debug, Clone)]
struct CachedJwks {
    /// The decoded JWKS from Supabase.
    keys: JwkSet,
    /// When the keys were fetched — used for TTL expiry.
    fetched_at: Instant,
}

impl CachedJwks {
    /// Returns `true` if the cache has expired.
    fn is_expired(&self) -> bool {
        self.fetched_at.elapsed() > JWKS_CACHE_TTL
    }
}

/// Fetch JWKS from Supabase, using the in-memory cache when valid.
///
/// 1. Lock the cache mutex
/// 2. If cached keys exist and haven't expired → return them
/// 3. Otherwise, fetch from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`
/// 4. Store in cache and return
async fn get_jwks() -> Result<JwkSet, AuthErrorKind> {
    let mut cache = JWKS_CACHE.lock().await;

    // Return cached keys if still valid
    if let Some(ref cached) = *cache {
        if !cached.is_expired() {
            tracing::debug!(
                age_secs = cached.fetched_at.elapsed().as_secs(),
                "Using cached JWKS"
            );
            return Ok(cached.keys.clone());
        }
        tracing::info!("JWKS cache expired, refetching");
    }

    // Build the JWKS URL from the Supabase project URL
    let supabase_url = std::env::var("NEXT_PUBLIC_SUPABASE_URL").map_err(|_| {
        AuthErrorKind::ServerError("NEXT_PUBLIC_SUPABASE_URL is not configured".to_string())
    })?;

    let jwks_url = format!(
        "{}/auth/v1/.well-known/jwks.json",
        supabase_url.trim_end_matches('/')
    );

    tracing::info!(url = %jwks_url, "Fetching JWKS from Supabase");

    // Fetch and parse the JWKS
    let response = HTTP_CLIENT
        .get(&jwks_url)
        .send()
        .await
        .map_err(|e| AuthErrorKind::ServerError(format!("Failed to fetch JWKS: {e}")))?;

    if !response.status().is_success() {
        return Err(AuthErrorKind::ServerError(format!(
            "JWKS endpoint returned HTTP {}",
            response.status()
        )));
    }

    let jwks: JwkSet = response
        .json()
        .await
        .map_err(|e| AuthErrorKind::ServerError(format!("Failed to parse JWKS: {e}")))?;

    if jwks.keys.is_empty() {
        return Err(AuthErrorKind::ServerError(
            "JWKS response contained no keys".to_string(),
        ));
    }

    tracing::info!(
        key_count = jwks.keys.len(),
        "JWKS fetched and cached successfully"
    );

    // Update the cache
    *cache = Some(CachedJwks {
        keys: jwks.clone(),
        fetched_at: Instant::now(),
    });

    Ok(jwks)
}

// ── User Role ───────────────────────────────────────────────────

/// User role within the OpenForum platform.
///
/// Stored as a custom claim (`user_role`) in the Supabase JWT,
/// typically set via `app_metadata` in the Supabase dashboard or
/// a server-side admin call.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    /// Default role — can read articles and submit drafts.
    Student,
    /// Can publish articles and manage their own content.
    Editor,
    /// Full platform access — can manage users and all content.
    Admin,
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Student => write!(f, "student"),
            UserRole::Editor => write!(f, "editor"),
            UserRole::Admin => write!(f, "admin"),
        }
    }
}

// ── AuthUser (Extractor) ────────────────────────────────────────

/// Authenticated user information extracted from a valid Supabase JWT.
///
/// Use as an Axum extractor in any handler that requires authentication:
///
/// ```rust
/// async fn handler(user: AuthUser) -> String {
///     format!("{} is a {}", user.email, user.role)
/// }
/// ```
#[derive(Debug, Clone, Serialize)]
pub struct AuthUser {
    /// The user's UUID (from the JWT `sub` claim).
    pub user_id: Uuid,
    /// The user's email address (verified by Supabase).
    pub email: String,
    /// The user's role (from `app_metadata.role` or `user_role` claim).
    pub role: UserRole,
}

// ── JWT Claims ──────────────────────────────────────────────────

/// Supabase JWT claims structure.
///
/// Supabase embeds standard OIDC claims plus custom `app_metadata`.
#[derive(Debug, Deserialize)]
struct SupabaseClaims {
    /// Subject — the user's UUID.
    sub: String,
    /// User's email address.
    email: Option<String>,
    /// Token expiry (Unix timestamp) — validated by `jsonwebtoken`.
    #[allow(dead_code)]
    exp: usize,
    /// Top-level custom claim for user role (optional).
    user_role: Option<String>,
    /// Supabase `app_metadata` — may contain `role`.
    app_metadata: Option<AppMetadata>,
}

/// Supabase `app_metadata` JWT claim.
#[derive(Debug, Deserialize)]
struct AppMetadata {
    /// User role stored in app_metadata (set via Supabase admin API).
    role: Option<String>,
}

impl SupabaseClaims {
    /// Resolve the user's role from claims, checking multiple locations:
    /// 1. Top-level `user_role` claim
    /// 2. `app_metadata.role`
    /// 3. Default to `Student`
    fn resolve_role(&self) -> UserRole {
        let role_str = self
            .user_role
            .as_deref()
            .or(self.app_metadata.as_ref().and_then(|m| m.role.as_deref()));

        match role_str {
            Some(r) => match r.to_lowercase().as_str() {
                "admin" => UserRole::Admin,
                "editor" => UserRole::Editor,
                _ => UserRole::Student,
            },
            None => UserRole::Student,
        }
    }
}

// ── Error Types ─────────────────────────────────────────────────

/// JSON error response body for authentication failures.
#[derive(Serialize)]
struct AuthErrorBody {
    error: &'static str,
    message: String,
}

/// Internal error kinds for authentication failures.
enum AuthErrorKind {
    /// No Authorization header present.
    MissingHeader,
    /// Authorization header doesn't match "Bearer <token>" format.
    InvalidFormat,
    /// JWT signature, expiry, or claims validation failed.
    InvalidToken(String),
    /// Email domain is not @csvtu.ac.in.
    DomainRestriction,
    /// Server-side issue (JWKS fetch failure, missing config).
    ServerError(String),
}

impl IntoResponse for AuthErrorKind {
    fn into_response(self) -> Response {
        let (status, error, message) = match self {
            AuthErrorKind::MissingHeader => (
                StatusCode::UNAUTHORIZED,
                "missing_token",
                "Authorization header is required".to_string(),
            ),
            AuthErrorKind::InvalidFormat => (
                StatusCode::UNAUTHORIZED,
                "invalid_format",
                "Authorization header must be: Bearer <token>".to_string(),
            ),
            AuthErrorKind::InvalidToken(msg) => (
                StatusCode::UNAUTHORIZED,
                "invalid_token",
                format!("Token validation failed: {msg}"),
            ),
            AuthErrorKind::DomainRestriction => (
                StatusCode::FORBIDDEN,
                "domain_restricted",
                "Only @csvtu.ac.in email addresses are allowed".to_string(),
            ),
            AuthErrorKind::ServerError(msg) => {
                tracing::error!(error = %msg, "Auth server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "server_error",
                    "Authentication service is temporarily unavailable".to_string(),
                )
            }
        };

        (status, Json(AuthErrorBody { error, message })).into_response()
    }
}

// ── FromRequestParts Implementation ─────────────────────────────

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // ── Step 1: Extract the Authorization header ────────────
        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AuthErrorKind::MissingHeader.into_response())?;

        // ── Step 2: Parse "Bearer <token>" ──────────────────────
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AuthErrorKind::InvalidFormat.into_response())?;

        // ── Step 3: Decode JWT header to get `kid` ──────────────
        let header = decode_header(token).map_err(|e| {
            AuthErrorKind::InvalidToken(format!("Malformed JWT header: {e}")).into_response()
        })?;

        // ── Step 4-7: Validate token based on declared algorithm ─
        let claims = match header.alg {
            Algorithm::HS256 => {
                let secret = std::env::var("AXUM_JWT_SECRET").map_err(|_| {
                    AuthErrorKind::ServerError("AXUM_JWT_SECRET is not configured".to_string())
                        .into_response()
                })?;

                let mut validation = Validation::new(Algorithm::HS256);
                validation.set_audience(&["authenticated"]);

                decode::<SupabaseClaims>(
                    token,
                    &DecodingKey::from_secret(secret.as_bytes()),
                    &validation,
                )
                .map_err(|e| AuthErrorKind::InvalidToken(e.to_string()).into_response())?
                .claims
            }
            Algorithm::RS256 => {
                let kid = header.kid.ok_or_else(|| {
                    AuthErrorKind::InvalidToken("JWT header missing `kid` (key ID)".to_string())
                        .into_response()
                })?;

                let jwks = get_jwks().await.map_err(|e| e.into_response())?;
                let jwk = jwks.find(&kid).ok_or_else(|| {
                    AuthErrorKind::InvalidToken(format!("No matching key found for kid '{kid}'"))
                        .into_response()
                })?;

                let decoding_key = DecodingKey::from_jwk(jwk).map_err(|e| {
                    AuthErrorKind::InvalidToken(format!(
                        "Failed to build decoding key from JWK: {e}"
                    ))
                    .into_response()
                })?;

                let mut validation = Validation::new(Algorithm::RS256);
                validation.set_audience(&["authenticated"]);

                decode::<SupabaseClaims>(token, &decoding_key, &validation)
                    .map_err(|e| AuthErrorKind::InvalidToken(e.to_string()).into_response())?
                    .claims
            }
            _ => {
                return Err(AuthErrorKind::InvalidToken(
                    "Unsupported JWT algorithm. Expected RS256 or HS256".to_string(),
                )
                .into_response());
            }
        };

        // ── Step 8: Extract and validate email domain ───────────
        let email = claims.email.clone().unwrap_or_default();

        if !email.ends_with(ALLOWED_DOMAIN) {
            tracing::warn!(
                email = %email,
                "Rejected login: email domain not allowed"
            );
            return Err(AuthErrorKind::DomainRestriction.into_response());
        }

        // ── Step 9: Parse user UUID from `sub` ──────────────────
        let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
            AuthErrorKind::InvalidToken(format!("Invalid UUID in `sub` claim: {e}")).into_response()
        })?;

        // ── Step 10: Resolve role from claims ───────────────────
        let role = claims.resolve_role();

        tracing::debug!(
            user_id = %user_id,
            email = %email,
            role = %role,
            "JWT validated successfully"
        );

        Ok(AuthUser {
            user_id,
            email,
            role,
        })
    }
}

// ── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_role_deserialize() {
        assert_eq!(
            serde_json::from_str::<UserRole>("\"student\"").unwrap(),
            UserRole::Student,
        );
        assert_eq!(
            serde_json::from_str::<UserRole>("\"editor\"").unwrap(),
            UserRole::Editor,
        );
        assert_eq!(
            serde_json::from_str::<UserRole>("\"admin\"").unwrap(),
            UserRole::Admin,
        );
    }

    #[test]
    fn test_user_role_serialize() {
        assert_eq!(
            serde_json::to_string(&UserRole::Student).unwrap(),
            "\"student\""
        );
        assert_eq!(
            serde_json::to_string(&UserRole::Editor).unwrap(),
            "\"editor\""
        );
        assert_eq!(
            serde_json::to_string(&UserRole::Admin).unwrap(),
            "\"admin\""
        );
    }

    #[test]
    fn test_resolve_role_from_top_level_claim() {
        let claims = SupabaseClaims {
            sub: "test".to_string(),
            email: Some("test@csvtu.ac.in".to_string()),
            exp: 9999999999,
            user_role: Some("admin".to_string()),
            app_metadata: None,
        };
        assert_eq!(claims.resolve_role(), UserRole::Admin);
    }

    #[test]
    fn test_resolve_role_from_app_metadata() {
        let claims = SupabaseClaims {
            sub: "test".to_string(),
            email: Some("test@csvtu.ac.in".to_string()),
            exp: 9999999999,
            user_role: None,
            app_metadata: Some(AppMetadata {
                role: Some("editor".to_string()),
            }),
        };
        assert_eq!(claims.resolve_role(), UserRole::Editor);
    }

    #[test]
    fn test_resolve_role_defaults_to_student() {
        let claims = SupabaseClaims {
            sub: "test".to_string(),
            email: Some("test@csvtu.ac.in".to_string()),
            exp: 9999999999,
            user_role: None,
            app_metadata: None,
        };
        assert_eq!(claims.resolve_role(), UserRole::Student);
    }

    #[test]
    fn test_top_level_role_takes_precedence() {
        let claims = SupabaseClaims {
            sub: "test".to_string(),
            email: Some("test@csvtu.ac.in".to_string()),
            exp: 9999999999,
            user_role: Some("admin".to_string()),
            app_metadata: Some(AppMetadata {
                role: Some("student".to_string()),
            }),
        };
        // Top-level claim wins over app_metadata
        assert_eq!(claims.resolve_role(), UserRole::Admin);
    }
}
