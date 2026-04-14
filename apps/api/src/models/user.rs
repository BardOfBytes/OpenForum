use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub roll_number: Option<String>,
    pub branch: Option<String>,
    pub year: Option<u8>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
}
