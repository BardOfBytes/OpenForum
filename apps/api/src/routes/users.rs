//! User routes — profile management.
//!
//! ## Endpoints
//!
//! | Method | Path           | Auth     | Description                  |
//! |--------|----------------|----------|------------------------------|
//! | GET    | `/users/me`    | Required | Get current user profile     |
//! | PUT    | `/users/me`    | Required | Update current user profile  |

use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::middleware::auth::AuthUser;
use crate::state::AppState;

const PROFILE_SELECT: &str = "id,email,display_name,roll_number,branch,year,avatar_url,bio";

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

#[derive(Debug, Deserialize)]
struct SupabaseProfileRow {
    id: String,
    email: String,
    display_name: String,
    roll_number: Option<String>,
    branch: Option<String>,
    year: Option<u8>,
    avatar_url: Option<String>,
    bio: Option<String>,
}

#[derive(Debug, Serialize)]
struct SupabaseProfileUpsertPayload {
    id: String,
    email: String,
    display_name: String,
    updated_at: String,
}

#[derive(Debug, Default, Serialize)]
struct SupabaseProfilePatchPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    roll_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bio: Option<String>,
    updated_at: String,
}

impl SupabaseProfilePatchPayload {
    fn has_mutations(&self) -> bool {
        self.display_name.is_some()
            || self.roll_number.is_some()
            || self.branch.is_some()
            || self.year.is_some()
            || self.bio.is_some()
    }
}

fn default_name_from_email(email: &str) -> String {
    email.split('@').next().unwrap_or("Student").to_string()
}

fn map_profile(row: SupabaseProfileRow) -> UserProfile {
    UserProfile {
        id: row.id,
        email: row.email,
        name: row.display_name,
        roll_number: row.roll_number,
        branch: row.branch,
        year: row.year,
        avatar_url: row.avatar_url,
        bio: row.bio,
    }
}

fn supabase_admin_env() -> Result<(String, String), StatusCode> {
    let supabase_url =
        std::env::var("NEXT_PUBLIC_SUPABASE_URL").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let service_key =
        std::env::var("SUPABASE_SERVICE_KEY").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if supabase_url.trim().is_empty() || service_key.trim().is_empty() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok((supabase_url.trim_end_matches('/').to_string(), service_key))
}

async fn fetch_profile(
    client: &reqwest::Client,
    supabase_url: &str,
    service_key: &str,
    user_id: &str,
) -> Result<Option<SupabaseProfileRow>, StatusCode> {
    let id_filter = format!("eq.{user_id}");
    let endpoint = format!("{supabase_url}/rest/v1/profiles");
    let response = client
        .get(endpoint)
        .header("apikey", service_key)
        .header("Authorization", format!("Bearer {service_key}"))
        .header("Accept", "application/json")
        .query(&[
            ("id", id_filter.as_str()),
            ("select", PROFILE_SELECT),
            ("limit", "1"),
        ])
        .send()
        .await
        .map_err(|error| {
            tracing::error!(error = %error, user_id = %user_id, "Supabase profile fetch failed");
            StatusCode::BAD_GATEWAY
        })?;

    if !response.status().is_success() {
        tracing::error!(
            status = %response.status(),
            user_id = %user_id,
            "Supabase profile fetch returned non-success"
        );
        return Err(StatusCode::BAD_GATEWAY);
    }

    let rows: Vec<SupabaseProfileRow> = response.json().await.map_err(|error| {
        tracing::error!(
            error = %error,
            user_id = %user_id,
            "Supabase profile fetch returned invalid JSON"
        );
        StatusCode::BAD_GATEWAY
    })?;

    Ok(rows.into_iter().next())
}

async fn upsert_default_profile(
    client: &reqwest::Client,
    supabase_url: &str,
    service_key: &str,
    user: &AuthUser,
) -> Result<UserProfile, StatusCode> {
    let endpoint = format!("{supabase_url}/rest/v1/profiles");
    let payload = SupabaseProfileUpsertPayload {
        id: user.user_id.to_string(),
        email: user.email.clone(),
        display_name: default_name_from_email(&user.email),
        updated_at: Utc::now().to_rfc3339(),
    };

    let response = client
        .post(endpoint)
        .header("apikey", service_key)
        .header("Authorization", format!("Bearer {service_key}"))
        .header("Prefer", "resolution=merge-duplicates,return=representation")
        .query(&[("on_conflict", "id"), ("select", PROFILE_SELECT)])
        .json(&payload)
        .send()
        .await
        .map_err(|error| {
            tracing::error!(error = %error, user_id = %user.user_id, "Supabase profile upsert failed");
            StatusCode::BAD_GATEWAY
        })?;

    if !response.status().is_success() {
        tracing::error!(
            status = %response.status(),
            user_id = %user.user_id,
            "Supabase profile upsert returned non-success"
        );
        return Err(StatusCode::BAD_GATEWAY);
    }

    let rows: Vec<SupabaseProfileRow> = response.json().await.map_err(|error| {
        tracing::error!(
            error = %error,
            user_id = %user.user_id,
            "Supabase profile upsert returned invalid JSON"
        );
        StatusCode::BAD_GATEWAY
    })?;

    let profile = rows.into_iter().next().unwrap_or(SupabaseProfileRow {
        id: user.user_id.to_string(),
        email: user.email.clone(),
        display_name: default_name_from_email(&user.email),
        roll_number: None,
        branch: None,
        year: None,
        avatar_url: None,
        bio: None,
    });

    Ok(map_profile(profile))
}

async fn get_or_create_profile(user: &AuthUser) -> Result<UserProfile, StatusCode> {
    let (supabase_url, service_key) = supabase_admin_env()?;
    let client = reqwest::Client::new();

    if let Some(profile) = fetch_profile(
        &client,
        &supabase_url,
        &service_key,
        &user.user_id.to_string(),
    )
    .await?
    {
        return Ok(map_profile(profile));
    }

    upsert_default_profile(&client, &supabase_url, &service_key, user).await
}

/// `GET /users/me` — get the authenticated user's profile.
async fn get_me(_state: State<AppState>, user: AuthUser) -> Result<Json<UserProfile>, StatusCode> {
    let profile = get_or_create_profile(&user).await?;
    Ok(Json(profile))
}

/// `PUT /users/me` — update the authenticated user's profile.
async fn update_me(
    _state: State<AppState>,
    user: AuthUser,
    Json(payload): Json<UpdateProfilePayload>,
) -> Result<Json<UserProfile>, StatusCode> {
    tracing::info!(user_id = %user.user_id, "Profile update requested");

    if let Some(year) = payload.year
        && !(1..=8).contains(&year)
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    let (supabase_url, service_key) = supabase_admin_env()?;
    let client = reqwest::Client::new();

    let patch_payload = SupabaseProfilePatchPayload {
        display_name: payload.name.map(|value| value.trim().to_string()),
        roll_number: payload.roll_number.map(|value| value.trim().to_string()),
        branch: payload.branch.map(|value| value.trim().to_string()),
        year: payload.year,
        bio: payload
            .bio
            .map(|value| ammonia::clean(&value).trim().to_string()),
        updated_at: Utc::now().to_rfc3339(),
    };

    if !patch_payload.has_mutations() {
        let profile = get_or_create_profile(&user).await?;
        return Ok(Json(profile));
    }

    let user_id = user.user_id.to_string();
    let id_filter = format!("eq.{user_id}");
    let endpoint = format!("{supabase_url}/rest/v1/profiles");
    let response = client
        .patch(endpoint)
        .header("apikey", &service_key)
        .header("Authorization", format!("Bearer {service_key}"))
        .header("Prefer", "return=representation")
        .query(&[("id", id_filter.as_str()), ("select", PROFILE_SELECT)])
        .json(&patch_payload)
        .send()
        .await
        .map_err(|error| {
            tracing::error!(error = %error, user_id = %user.user_id, "Supabase profile update failed");
            StatusCode::BAD_GATEWAY
        })?;

    if !response.status().is_success() {
        tracing::error!(
            status = %response.status(),
            user_id = %user.user_id,
            "Supabase profile update returned non-success"
        );
        return Err(StatusCode::BAD_GATEWAY);
    }

    let rows: Vec<SupabaseProfileRow> = response.json().await.map_err(|error| {
        tracing::error!(
            error = %error,
            user_id = %user.user_id,
            "Supabase profile update returned invalid JSON"
        );
        StatusCode::BAD_GATEWAY
    })?;

    let profile = if let Some(row) = rows.into_iter().next() {
        map_profile(row)
    } else {
        get_or_create_profile(&user).await?
    };

    Ok(Json(profile))
}

/// Mount user routes onto a router.
pub fn router() -> Router<AppState> {
    Router::new().route("/users/me", get(get_me).put(update_me))
}
