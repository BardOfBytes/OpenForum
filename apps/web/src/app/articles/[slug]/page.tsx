import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArticleGrid } from "@/components/home/ArticleGrid";
import {
  ApiHttpError,
  getArticleBySlug,
  getArticles,
  type ArticleListItem,
} from "@/lib/api/articles";
import { categorySlugFromName, getCategoryBySlug } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface ArticleDetailPageProps {
  params: Promise<{ slug: string }>;
}

const getArticleBySlugCached = cache(async (slug: string) => getArticleBySlug(slug));

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
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

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;

  try {
    const article = await getArticleBySlugCached(slug);
    const resolvedBody = stripLeadingCoverImage(article.body, article.coverImageUrl);
    const categorySlug = categorySlugFromName(article.category.name);
    const knownCategory = getCategoryBySlug(categorySlug);

    let relatedArticles: ArticleListItem[] = [];
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
      console.warn(`[articles/${slug}] Failed to load related stories`, error);
    }

    return (
      <>
        <Navbar />
        <main className="py-12 md:py-16">
          <article className="container-narrow">
            <div className="mb-8">
              <span
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium font-body"
                style={{
                  backgroundColor: `${article.category.color}22`,
                  color: article.category.color,
                }}
              >
                {article.category.name}
              </span>

              <h1 className="font-heading text-3xl md:text-5xl font-semibold text-text tracking-tight mt-4">
                {article.title}
              </h1>

              <p className="font-body text-text-secondary mt-4 text-lg leading-relaxed">
                {article.excerpt}
              </p>

              <div className="mt-6 text-sm text-text-tertiary font-body">
                <span>{article.author.name}</span>
                <span className="mx-2">·</span>
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                <span className="mx-2">·</span>
                <span>{article.readTimeMinutes} min read</span>
              </div>
            </div>

            <div className="mb-10 rounded-xl overflow-hidden border border-border-light bg-surface min-h-[220px] relative">
              {article.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.coverImageUrl}
                  alt=""
                  className="w-full h-full max-h-[460px] object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${article.category.color}20 0%, ${article.category.color}06 100%)`,
                  }}
                  aria-hidden="true"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-body text-sm uppercase tracking-widest text-text-tertiary">
                      {article.category.name}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div
              className="article-content prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: resolvedBody }}
            />

            {article.tags.length > 0 && (
              <div className="mt-12 pt-6 border-t border-border-light">
                <h2 className="font-body text-sm uppercase tracking-widest text-text-tertiary mb-3">
                  Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {relatedArticles.length > 0 && (
              <section className="mt-14 pt-8 border-t border-border-light">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
                  <div>
                    <h2 className="font-heading text-2xl font-semibold text-text tracking-tight">
                      More To Read
                    </h2>
                    <p className="font-body text-sm text-text-secondary mt-1">
                      {knownCategory
                        ? `More stories from ${knownCategory.name}`
                        : "Related stories from the latest feed"}
                    </p>
                  </div>
                  <Link
                    href={knownCategory ? ROUTES.category.detail(categorySlug) : ROUTES.articles}
                    className="inline-flex items-center text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                  >
                    {knownCategory ? "Browse category" : "Browse all articles"}
                  </Link>
                </div>

                <ArticleGrid articles={relatedArticles} maxColumns={2} />
              </section>
            )}

            <section className="mt-12 rounded-2xl border border-border-light bg-surface p-7 md:p-8">
              <h2 className="font-heading text-2xl font-semibold text-text tracking-tight mb-3">
                Join The Conversation
              </h2>
              <p className="font-body text-text-secondary leading-relaxed mb-5">
                Have a response, counterpoint, or original angle? Publish your own piece and keep
                the discussion moving.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={ROUTES.write}
                  className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
                >
                  Write your article
                </Link>
                <Link
                  href={ROUTES.articles}
                  className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-bg-elevated transition-colors"
                >
                  Back to latest
                </Link>
              </div>
            </section>
          </article>
        </main>
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
