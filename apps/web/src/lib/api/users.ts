import {
  ApiBuildTimeFetchSkippedError,
  apiUrl,
  isProductionBuildPhase,
} from "@/lib/api/base-url";

export interface PublicUserProfile {
  id: string;
  name: string;
  branch: string | null;
  year: number | null;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  isFollowing: boolean;
}

interface ApiPublicUserProfile {
  id: string;
  name: string;
  branch: string | null;
  year: number | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  is_following: boolean;
}

export async function getPublicUserProfile(
  userId: string,
  accessToken?: string | null
): Promise<PublicUserProfile> {
  if (isProductionBuildPhase()) {
    throw new ApiBuildTimeFetchSkippedError();
  }

  const response = await fetch(apiUrl(`/api/v1/users/${userId}`), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    ...(accessToken ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
  });

  if (!response.ok) {
    throw new Error(`Could not load public profile (HTTP ${response.status})`);
  }

  const profile = (await response.json()) as ApiPublicUserProfile;
  return {
    id: profile.id,
    name: profile.name,
    branch: profile.branch,
    year: profile.year,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    followerCount: profile.follower_count,
    isFollowing: profile.is_following,
  };
}
