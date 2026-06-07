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
  headline: string | null;
  bio: string | null;
  followerCount: number;
  isFollowing: boolean;
  createdAt: string | null;
}

export interface AuthorSummary {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  articlesPublished: number;
  totalViews: number;
  followerCount: number;
}

interface ApiPublicUserProfile {
  id: string;
  name: string;
  branch: string | null;
  year: number | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  follower_count: number;
  is_following: boolean;
  created_at: string | null;
}

interface ApiAuthorSummary {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  articles_published: number;
  total_views: number;
  follower_count: number;
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
    headline: profile.headline,
    bio: profile.bio,
    followerCount: profile.follower_count,
    isFollowing: profile.is_following,
    createdAt: profile.created_at,
  };
}

export async function getAuthors(): Promise<AuthorSummary[]> {
  if (isProductionBuildPhase()) {
    throw new ApiBuildTimeFetchSkippedError();
  }

  const response = await fetch(apiUrl("/api/v1/authors"), {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Could not load authors (HTTP ${response.status})`);
  }

  const authors = (await response.json()) as ApiAuthorSummary[];
  return authors.map((author) => ({
    id: author.id,
    name: author.name,
    username: author.username,
    avatarUrl: author.avatar_url,
    headline: author.headline,
    bio: author.bio,
    articlesPublished: author.articles_published,
    totalViews: author.total_views,
    followerCount: author.follower_count,
  }));
}
