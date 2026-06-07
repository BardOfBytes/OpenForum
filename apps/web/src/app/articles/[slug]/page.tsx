import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import katex from "katex";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArticleDetailExperience } from "@/components/articles/ArticleDetailExperience";
import { ReadingProgress } from "@/components/articles/ReadingProgress";
import { createClient } from "@/lib/supabase/server";
import {
  ApiHttpError,
  getArticleSocialState,
  getArticleBySlug,
  getArticles,
  type ArticleSocialState,
  type ArticleListItem,
} from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { categorySlugFromName, getCategoryBySlug } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface ArticleDetailPageProps {
  params: Promise<{ slug: string }>;
}

const getArticleBySlugCached = cache(async (slug: string) => getArticleBySlug(slug));
const YOUTUBE_EMBED_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "m.youtube.com",
  "youtu.be",
]);

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const article = await getArticleBySlugCached(slug);
    return {
      title: {
        absolute: article.title,
      },
      description: article.excerpt,
    };
  } catch {
    return {
      title: "Article",
    };
  }
}

function stripLeadingCoverImage(bodyHtml: string, coverUrl: string | null): string {
  const cover = coverUrl?.trim();
  if (!cover) {
    return bodyHtml;
  }

  const match = bodyHtml.match(
    /^\s*(?:<(?:p|figure)[^>]*>\s*)?(<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*)(?:<\/(?:p|figure)>\s*)?/i
  );

  if (!match) {
    return bodyHtml;
  }

  const leadingSrc = match[2]?.trim();
  if (!leadingSrc || leadingSrc !== cover) {
    return bodyHtml;
  }

  return bodyHtml.slice(match[0].length).replace(/^\s+/, "");
}

function normalizeYoutubeEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();

    if (!YOUTUBE_EMBED_HOSTS.has(host)) {
      return null;
    }

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace(/^\/+/, "").split("/")[0];
      if (!videoId) {
        return null;
      }
      return `https://www.youtube.com/embed/${videoId}`;
    }

    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.toString();
    }

    if (parsed.pathname === "/watch") {
      const videoId = parsed.searchParams.get("v")?.trim();
      if (!videoId) {
        return null;
      }
      return `https://www.youtube.com/embed/${videoId}`;
    }

    return null;
  } catch {
    return null;
  }
}

function extractLeadingYoutubeEmbed(bodyHtml: string): {
  videoUrl: string | null;
  bodyWithoutVideo: string;
} {
  const match = bodyHtml.match(
    /^\s*(?:<(?:div|figure)[^>]*>\s*)?<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/iframe>\s*(?:<\/(?:div|figure)>\s*)?/i
  );

  if (!match) {
    return {
      videoUrl: null,
      bodyWithoutVideo: bodyHtml,
    };
  }

  const normalizedVideoUrl = normalizeYoutubeEmbedUrl(match[1] ?? "");
  if (!normalizedVideoUrl) {
    return {
      videoUrl: null,
      bodyWithoutVideo: bodyHtml,
    };
  }

  return {
    videoUrl: normalizedVideoUrl,
    bodyWithoutVideo: bodyHtml.slice(match[0].length).replace(/^\s+/, ""),
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractAttrValue(tagHtml: string, attrName: string): string | null {
  const doubleQuoted = new RegExp(`${attrName}\\s*=\\s*\"([^\"]*)\"`, "i");
  const singleQuoted = new RegExp(`${attrName}\\s*=\\s*'([^']*)'`, "i");

  const doubleMatch = tagHtml.match(doubleQuoted);
  if (doubleMatch?.[1]) {
    return decodeHtmlEntities(doubleMatch[1]);
  }

  const singleMatch = tagHtml.match(singleQuoted);
  if (singleMatch?.[1]) {
    return decodeHtmlEntities(singleMatch[1]);
  }

  return null;
}

function renderMathNodes(bodyHtml: string): string {
  return bodyHtml.replace(
    /<(span|div)\b[^>]*\bdata-type\s*=\s*["'](inline-math|block-math)["'][^>]*>\s*<\/(span|div)>/gi,
    (fullMatch, _tagName, mathKind) => {
      const latex = extractAttrValue(fullMatch, "data-latex")?.trim();
      if (!latex) {
        return fullMatch;
      }

      try {
        const katexHtml = katex.renderToString(latex, {
          displayMode: mathKind === "block-math",
          throwOnError: false,
          strict: false,
        });

        if (mathKind === "block-math") {
          return `<div class="katex-block">${katexHtml}</div>`;
        }

        return `<span class="katex-inline">${katexHtml}</span>`;
      } catch {
        if (mathKind === "block-math") {
          return `<pre class="math-fallback">${escapeHtml(latex)}</pre>`;
        }
        return `<code class="math-fallback">${escapeHtml(latex)}</code>`;
      }
    }
  );
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;

  try {
    const article = await getArticleBySlugCached(slug);
    const resolvedBody = stripLeadingCoverImage(article.body, article.coverImageUrl);
    const { videoUrl: leadingVideoUrl, bodyWithoutVideo } = extractLeadingYoutubeEmbed(
      resolvedBody
    );
    const renderedBody = renderMathNodes(bodyWithoutVideo);
    const categorySlug = categorySlugFromName(article.category.name);
    const knownCategory = getCategoryBySlug(categorySlug);
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let relatedArticles: ArticleListItem[] = [];
    let articleSocialState: ArticleSocialState | null = null;
    try {
      const sameCategory = await getArticles({ category: categorySlug, perPage: 8 });
      relatedArticles = sameCategory.filter((candidate) => candidate.slug !== slug).slice(0, 3);

      if (relatedArticles.length < 3) {
        const latest = await getArticles({ perPage: 12 });
        const seen = new Set([slug, ...relatedArticles.map((item) => item.slug)]);

        for (const candidate of latest) {
          if (seen.has(candidate.slug)) {
            continue;
          }

          relatedArticles.push(candidate);
          seen.add(candidate.slug);

          if (relatedArticles.length === 3) {
            break;
          }
        }
      }
    } catch (error) {
      if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
        console.warn(`[articles/${slug}] Failed to load related stories`, error);
      }
    }

    try {
      articleSocialState = await getArticleSocialState(slug, session?.access_token);
    } catch (error) {
      if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
        console.warn(`[articles/${slug}] Failed to load article social state`, error);
      }
    }

    return (
      <>
        <ReadingProgress />
        <Navbar />
        <ArticleDetailExperience
          article={article}
          renderedBody={renderedBody}
          leadingVideoUrl={leadingVideoUrl}
          relatedArticles={relatedArticles}
          articleSocialState={articleSocialState}
          categorySlug={categorySlug}
          knownCategoryName={knownCategory?.name ?? null}
        />
        <Footer />
      </>
    );
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 404) {
      notFound();
    }

    return (
      <>
        <Navbar />
        <main className="py-12 md:py-16">
          <section className="container-editorial">
            <div className="rounded-xl border border-error/30 bg-bg-elevated p-8">
              <h1 className="font-heading text-2xl font-semibold text-text mb-2">
                Could not load this article
              </h1>
              <p className="font-body text-text-secondary mb-6">
                Please try again in a few minutes.
              </p>
              <Link
                href={ROUTES.articles}
                className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
              >
                Back to Articles
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }
}
