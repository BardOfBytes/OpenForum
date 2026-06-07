import { ROUTES } from "@/lib/routes";
import {
  ApiBuildTimeFetchSkippedError,
  apiUrl,
  isProductionBuildPhase,
} from "@/lib/api/base-url";

export interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  category: { name: string; color: string };
  author: {
    id: string | null;
    name: string;
    avatarUrl: string | null;
    username?: string | null;
    headline?: string | null;
    bio?: string | null;
    articlesPublished?: number;
    totalViews?: number;
  };
  readTimeMinutes: number;
  publishedAt: string;
  views: number;
  featured: boolean;
}

export interface ArticleDetail extends ArticleListItem {
  subtitle: string;
  body: string;
  tags: string[];
}

export interface SocialState {
  active: boolean;
  count: number;
}

export interface ArticleSocialState {
  like: SocialState;
  bookmark: SocialState;
}

interface ApiCategory {
  name: string;
  color: string;
}

interface ApiAuthor {
  id: string;
  name: string;
  avatar_url: string | null;
  username?: string | null;
  headline?: string | null;
  bio?: string | null;
  articles_published?: number;
  total_views?: number;
}

interface ApiArticlePreview {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  preview_image_url: string | null;
  created_at: string;
  views?: number;
  featured?: boolean;
  category: ApiCategory;
  author: ApiAuthor;
  read_time_minutes: number;
}

interface ApiArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  body: string;
  tags: string[];
  views: number;
  cover_image_url: string | null;
  created_at: string;
  category_detail: ApiCategory | null;
  author_detail: ApiAuthor | null;
  read_time_minutes: number;
}

interface ApiPaginated<T> {
  data: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface GetArticlesOptions {
  page?: number;
  perPage?: number;
  category?: string;
  author?: string;
  search?: string;
}

export interface GetArticlesPageResult {
  data: ArticleListItem[];
  page: number;
  perPage: number;
  total: number;
}

export class ApiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ARTICLES_FETCH_REVALIDATE_SECONDS = 60;

async function fetchJson<T>(path: string): Promise<T> {
  if (isProductionBuildPhase()) {
    throw new ApiBuildTimeFetchSkippedError();
  }

  const response = await fetch(apiUrl(path), {
    next: { revalidate: ARTICLES_FETCH_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new ApiHttpError(response.status, message);
  }

  return (await response.json()) as T;
}

function mapPreview(article: ApiArticlePreview): ArticleListItem {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    coverImageUrl: article.cover_image_url ?? article.preview_image_url,
    category: article.category,
    author: {
      id: article.author.id,
      name: article.author.name,
      avatarUrl: article.author.avatar_url,
      username: article.author.username ?? null,
      headline: article.author.headline ?? null,
      bio: article.author.bio ?? null,
      articlesPublished: article.author.articles_published ?? 0,
      totalViews: article.author.total_views ?? 0,
    },
    readTimeMinutes: article.read_time_minutes,
    publishedAt: article.created_at,
    views: article.views ?? 0,
    featured: article.featured ?? false,
  };
}

function buildArticlesPath(options: GetArticlesOptions = {}): string {
  const query = new URLSearchParams();

  if (options.page) {
    query.set("page", String(options.page));
  }
  if (options.perPage) {
    query.set("per_page", String(options.perPage));
  }
  if (options.category) {
    query.set("category", options.category);
  }
  if (options.author) {
    query.set("author", options.author);
  }
  if (options.search) {
    query.set("q", options.search);
  }

  return query.size > 0 ? `/api/v1/articles?${query.toString()}` : "/api/v1/articles";
}

export function mapDetail(article: ApiArticle): ArticleDetail {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    coverImageUrl: article.cover_image_url,
    category: article.category_detail ?? { name: "General", color: "#d4613c" },
    author: {
      id: article.author_detail?.id ?? null,
      name: article.author_detail?.name ?? "Unknown Author",
      avatarUrl: article.author_detail?.avatar_url ?? null,
      username: article.author_detail?.username ?? null,
      headline: article.author_detail?.headline ?? null,
      bio: article.author_detail?.bio ?? null,
      articlesPublished: article.author_detail?.articles_published ?? 0,
      totalViews: article.author_detail?.total_views ?? 0,
    },
    readTimeMinutes: article.read_time_minutes,
    publishedAt: article.created_at,
    subtitle: article.subtitle ?? "",
    body: article.body,
    tags: article.tags,
    views: article.views,
    featured: false,
  };
}

export async function getArticlesPage(
  options: GetArticlesOptions = {}
): Promise<GetArticlesPageResult> {
  const path = buildArticlesPath(options);
  const response = await fetchJson<ApiPaginated<ApiArticlePreview>>(path);
  return {
    data: response.data.map(mapPreview),
    page: response.page,
    perPage: response.per_page,
    total: response.total,
  };
}

export async function getArticles(options: GetArticlesOptions = {}): Promise<ArticleListItem[]> {
  const response = await getArticlesPage(options);
  return response.data;
}

export async function getArticleBySlug(slug: string): Promise<ArticleDetail> {
  const response = await fetchJson<ApiArticle>(`/api/v1/articles/${slug}`);
  return mapDetail(response);
}

export async function getArticleSocialState(
  slug: string,
  accessToken?: string | null
): Promise<ArticleSocialState> {
  if (isProductionBuildPhase()) {
    throw new ApiBuildTimeFetchSkippedError();
  }

  const response = await fetch(apiUrl(`/api/v1/articles/${slug}/social-state`), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    ...(accessToken ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
  });

  if (!response.ok) {
    throw new ApiHttpError(response.status, `Request failed (${response.status})`);
  }

  return (await response.json()) as ArticleSocialState;
}

export const ARTICLE_ROUTES = {
  list: ROUTES.articles,
  detail: ROUTES.article.detail,
};
