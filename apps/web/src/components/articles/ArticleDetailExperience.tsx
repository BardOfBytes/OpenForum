"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Eye, PenSquare } from "lucide-react";
import { ArticleActions } from "@/components/articles/ArticleActions";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { ArticleComments } from "@/components/articles/ArticleComments";
import { ArticleContent } from "@/components/articles/ArticleContent";
import { ArticleManagement } from "@/components/articles/ArticleManagement";
import type {
  ArticleDetail,
  ArticleListItem,
  ArticleSocialState,
} from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

interface ArticleDetailExperienceProps {
  article: ArticleDetail;
  renderedBody: string;
  leadingVideoUrl: string | null;
  relatedArticles: ArticleListItem[];
  articleSocialState: ArticleSocialState | null;
  categorySlug: string;
  knownCategoryName: string | null;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatViews(views: number): string {
  return new Intl.NumberFormat("en-IN").format(views);
}

export function ArticleDetailExperience({
  article,
  renderedBody,
  leadingVideoUrl,
  relatedArticles,
  articleSocialState,
  categorySlug,
  knownCategoryName,
}: ArticleDetailExperienceProps) {
  const authorInitials = initials(article.author.name) || "OF";
  const authorHeadline = article.author.headline?.trim() || "OpenForum contributor";
  const authorBio =
    article.author.bio?.trim() ||
    "Public author profiles expose display name, avatar, bio, follower count, and published work.";
  const filedUnder = Array.from(new Set([article.category.name, ...article.tags]));
  const hasAuthorStats =
    (article.author.articlesPublished ?? 0) > 0 || (article.author.totalViews ?? 0) > 0;

  return (
    <main className="flex-grow pb-6 pt-6">
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-3xl px-4 pt-10 md:px-8"
      >
        <Link
          href={ROUTES.articles}
          className="group mb-12 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Articles
        </Link>

        <header className="mb-12">
          <div className="mb-5">
            <Link href={ROUTES.category.detail(categorySlug)}>
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: `${article.category.color}1f`,
                  color: article.category.color,
                }}
              >
                {article.category.name}
              </span>
            </Link>
          </div>

          <h1 className="mb-6 font-serif text-4xl font-medium leading-[1.12] text-foreground md:text-5xl lg:text-[3.25rem]">
            {article.title}
          </h1>

          <p className="mb-8 border-l-[3px] border-primary/40 pl-5 font-serif text-xl italic leading-relaxed text-muted-foreground">
            {article.subtitle?.trim() ? article.subtitle : article.excerpt}
          </p>

          <div className="flex flex-col justify-between gap-4 border-y border-border py-5 sm:flex-row sm:items-center">
            {article.author.id ? (
              <Link
                href={ROUTES.author.detail(article.author.id)}
                className="group flex min-w-0 items-center gap-3.5"
              >
                <AuthorAvatar
                  name={article.author.name}
                  avatarUrl={article.author.avatarUrl}
                  fallback={authorInitials}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                    {article.author.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{authorHeadline}</div>
                </div>
              </Link>
            ) : (
              <div className="flex min-w-0 items-center gap-3.5">
                <AuthorAvatar
                  name={article.author.name}
                  avatarUrl={article.author.avatarUrl}
                  fallback={authorInitials}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {article.author.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{authorHeadline}</div>
                </div>
              </div>
            )}

            <div className="flex flex-shrink-0 items-center gap-4 text-xs text-muted-foreground">
              <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {article.readTimeMinutes} min read
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatViews(article.views)}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <ArticleActions
              slug={article.slug}
              title={article.title}
              initialLikeState={articleSocialState?.like}
              initialBookmarkState={articleSocialState?.bookmark}
            />
          </div>
        </header>

        <ArticleManagement article={article} />

        {leadingVideoUrl && (
          <div className="mb-10 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <iframe
              src={leadingVideoUrl}
              title={`${article.title} video`}
              className="block aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}

        <ArticleContent html={renderedBody} />

        {filedUnder.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-8">
            <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Filed under
            </span>
            {filedUnder.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <footer className="mt-12">
          <div className="flex flex-col items-start gap-5 rounded-2xl border border-border bg-card p-7 transition-colors hover:border-border/80 sm:flex-row">
            {article.author.id ? (
              <Link href={ROUTES.author.detail(article.author.id)}>
                <AuthorAvatar
                  name={article.author.name}
                  avatarUrl={article.author.avatarUrl}
                  fallback={authorInitials}
                  large
                />
              </Link>
            ) : (
              <AuthorAvatar
                name={article.author.name}
                avatarUrl={article.author.avatarUrl}
                fallback={authorInitials}
                large
              />
            )}
            <div className="min-w-0 flex-grow">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Written by
              </span>
              {article.author.id ? (
                <Link href={ROUTES.author.detail(article.author.id)}>
                  <h3 className="mb-0.5 font-serif text-xl font-medium transition-colors hover:text-primary">
                    {article.author.name}
                  </h3>
                </Link>
              ) : (
                <h3 className="mb-0.5 font-serif text-xl font-medium">
                  {article.author.name}
                </h3>
              )}
              <p className="mb-3 text-xs font-medium text-primary">{authorHeadline}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {authorBio}
              </p>
              {hasAuthorStats ? (
                <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                  <span>
                    <strong className="font-semibold text-foreground">
                      {article.author.articlesPublished ?? 0}
                    </strong>{" "}
                    published
                  </span>
                  <span>
                    <strong className="font-semibold text-foreground">
                      {formatViews(article.author.totalViews ?? 0)}
                    </strong>{" "}
                    total views
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </footer>

        <ArticleComments slug={article.slug} />
      </motion.article>

      <section className="container mx-auto mt-16 max-w-3xl px-4 md:px-8">
        <div className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-2xl bg-primary px-8 py-10 sm:flex-row">
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 80% 50%, white 0%, transparent 60%)",
            }}
          />
          <div className="relative text-primary-foreground">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-75">
              OpenForum · CSVTU
            </p>
            <h2 className="mb-1 font-serif text-2xl font-medium leading-tight md:text-3xl">
              Have something to say?
            </h2>
            <p className="max-w-sm text-sm opacity-80">
              Share your ideas, research, and stories with the CSVTU community.
            </p>
          </div>
          <div className="relative flex flex-shrink-0 flex-col items-center gap-3 sm:flex-row">
            <Link
              href={ROUTES.write}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary-foreground/90"
            >
              <PenSquare className="h-4 w-4" />
              Start writing
            </Link>
            <Link
              href={ROUTES.articles}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
            >
              Explore articles
            </Link>
          </div>
        </div>
      </section>

      {relatedArticles.length > 0 && (
        <section className="container mx-auto mt-20 max-w-3xl px-4 md:px-8">
          <div className="mb-7 flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="font-serif text-xl font-medium">More to Read</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {knownCategoryName
                  ? `More stories from ${knownCategoryName}`
                  : "Related stories from the latest feed"}
              </p>
            </div>
            <Link
              href={knownCategoryName ? ROUTES.category.detail(categorySlug) : ROUTES.articles}
              className="text-sm font-medium text-primary hover:underline"
            >
              All articles
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {relatedArticles.map((related, index) => (
              <ArticleCard
                key={related.slug}
                article={related}
                index={index}
                variant="horizontal"
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function AuthorAvatar({
  name,
  avatarUrl,
  fallback,
  large = false,
}: {
  name: string;
  avatarUrl: string | null;
  fallback: string;
  large?: boolean;
}) {
  const size = large ? "h-16 w-16 text-base" : "h-11 w-11 text-sm";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} flex-shrink-0 rounded-full border border-border object-cover transition-colors hover:border-primary/50`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${size} flex flex-shrink-0 items-center justify-center rounded-full border border-border bg-card font-semibold text-muted-foreground transition-colors hover:border-primary/50`}
    >
      {fallback}
    </div>
  );
}
