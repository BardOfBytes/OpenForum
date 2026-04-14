import { ROUTES } from "@/lib/routes";

export interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  category: { name: string; color: string };
  author: { name: string; avatarUrl: string | null };
  readTimeMinutes: number;
  publishedAt: string;
}

export interface ArticleDetail extends ArticleListItem {
  body: string;
  tags: string[];
  views: number;
}

interface ApiCategory {
  name: string;
  color: string;
}

interface ApiAuthor {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ApiArticlePreview {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  created_at: string;
  category: ApiCategory;
  author: ApiAuthor;
  read_time_minutes: number;
}

interface ApiArticle {
  id: string;
  slug: string;
  title: string;
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

export class ApiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: "no-store",
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
    coverImageUrl: article.cover_image_url,
    category: article.category,
    author: {
      name: article.author.name,
      avatarUrl: article.author.avatar_url,
    },
    readTimeMinutes: article.read_time_minutes,
    publishedAt: article.created_at,
  };
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
      name: article.author_detail?.name ?? "Unknown Author",
      avatarUrl: article.author_detail?.avatar_url ?? null,
    },
    readTimeMinutes: article.read_time_minutes,
    publishedAt: article.created_at,
    body: article.body,
    tags: article.tags,
    views: article.views,
  };
}

export async function getArticles(): Promise<ArticleListItem[]> {
  const response = await fetchJson<ApiPaginated<ApiArticlePreview>>("/api/v1/articles");
  return response.data.map(mapPreview);
}

export async function getArticleBySlug(slug: string): Promise<ArticleDetail> {
  const response = await fetchJson<ApiArticle>(`/api/v1/articles/${slug}`);
  return mapDetail(response);
}

export const ARTICLE_ROUTES = {
  list: ROUTES.articles,
  detail: ROUTES.article.detail,
};
