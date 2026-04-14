export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  write: "/write",
  articles: "/articles",
  categories: "/categories",
  categoryLegacy: "/category",
  about: "/about",
  guidelines: "/guidelines",
  privacy: "/privacy",
  terms: "/terms",
  feedLegacy: "/feed",
  articleNewLegacy: "/article/new",
  auth: {
    callback: "/auth/callback",
    error: "/auth/error",
  },
  article: {
    detail: (slug: string) => `/articles/${slug}`,
    detailLegacy: (slug: string) => `/article/${slug}`,
  },
  category: {
    detail: (slug: string) => `/categories/${slug}`,
    detailLegacy: (slug: string) => `/category/${slug}`,
  },
} as const;

export const DEFAULT_POST_LOGIN_REDIRECT = ROUTES.articles;

export function normalizePostLoginRedirect(next: string | null | undefined): string {
  if (!next) return DEFAULT_POST_LOGIN_REDIRECT;
  if (!next.startsWith("/")) return DEFAULT_POST_LOGIN_REDIRECT;
  if (next.startsWith("//")) return DEFAULT_POST_LOGIN_REDIRECT;
  return next;
}

export function legacyRedirectFor(pathname: string): string | null {
  if (pathname === ROUTES.feedLegacy) return ROUTES.articles;
  if (pathname === ROUTES.articleNewLegacy) return ROUTES.write;
  if (pathname === ROUTES.categoryLegacy) return ROUTES.categories;

  const legacyCategoryPrefix = `${ROUTES.categoryLegacy}/`;
  if (pathname.startsWith(legacyCategoryPrefix)) {
    const slug = pathname.slice(legacyCategoryPrefix.length).trim();
    if (!slug) return ROUTES.categories;
    return ROUTES.category.detail(slug);
  }

  const legacyArticlePrefix = "/article/";
  if (pathname.startsWith(legacyArticlePrefix)) {
    const slug = pathname.slice(legacyArticlePrefix.length).trim();
    if (!slug || slug === "new") return null;
    return ROUTES.article.detail(slug);
  }

  return null;
}
