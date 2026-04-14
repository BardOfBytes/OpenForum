//! User routes — profile management.
//!
//! ## Endpoints
//!
//! | Method | Path           | Auth     | Description                  |
//! |--------|----------------|----------|------------------------------|
//! | GET    | `/users/me`    | Required | Get current user profile     |
//! | PUT    | `/users/me`    | Required | Update current user profile  |

use axum::{Json, Router, http::StatusCode, routing::get};
use serde::{Deserialize, Serialize};

use crate::middleware::auth::AuthUser;
use crate::state::AppState;

/// User profile response.
#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub id: String,
    pub email: String,
    pub name: String,
    pub roll_number: Option<String>,
    pub branch: Option<String>,
    pub year: Option<u8>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
}

/// Payload for updating a user profile.
#[derive(Debug, Deserialize)]
pub struct UpdateProfilePayload {
    pub name: Option<String>,
    pub roll_number: Option<String>,
    pub branch: Option<String>,
    pub year: Option<u8>,
    pub bio: Option<String>,
}

/// `GET /users/me` — get the authenticated user's profile.
///
/// TODO: Connect to Supabase Postgres profiles table.
async fn get_me(user: AuthUser) -> Json<UserProfile> {
    // TODO: Fetch from database
    Json(UserProfile {
        id: user.user_id.to_string(),
        email: user.email.clone(),
        name: user
            .email
            .split('@')
            .next()
            .unwrap_or("Student")
            .to_string(),
        roll_number: None,
        branch: None,
        year: None,
        avatar_url: None,
        bio: None,
    })
}

/// `PUT /users/me` — update the authenticated user's profile.
///
/// TODO: Connect to Supabase Postgres profiles table.
async fn update_me(
    user: AuthUser,
    Json(payload): Json<UpdateProfilePayload>,
) -> Result<Json<UserProfile>, StatusCode> {
    // TODO: Validate and persist to database
    tracing::info!(user_id = %user.user_id, "Profile update requested");

    // Sanitize bio if present
    let clean_bio = payload.bio.map(|b| ammonia::clean(&b));

    Ok(Json(UserProfile {
        id: user.user_id.to_string(),
        email: user.email.clone(),
        name: payload.name.unwrap_or_else(|| {
            user.email
                .split('@')
                .next()
                .unwrap_or("Student")
                .to_string()
        }),
        roll_number: payload.roll_number,
        branch: payload.branch,
        year: payload.year,
        avatar_url: None,
        bio: clean_bio,
    }))
}

/// Mount user routes onto a router.
pub fn router() -> Router<AppState> {
    Router::new().route("/users/me", get(get_me).put(update_me))
}
