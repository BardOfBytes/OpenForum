/**
 * Featured Article — Asymmetric editorial layout
 *
 * Large image on the left, editorial text on the right.
 * Framer Motion fade-in animation on viewport entry.
 * Category tag in coral, serif title, author/date footer.
 *
 * This is a Client Component because of Framer Motion animations.
 */

"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface FeaturedArticleProps {
  article: {
    title: string;
    excerpt: string;
    slug: string;
    coverImageUrl: string | null;
    category: { name: string; color: string };
    author: { name: string; avatarUrl: string | null };
    readTimeMinutes: number;
    publishedAt: string;
  };
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function FeaturedArticle({ article }: FeaturedArticleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <Link
        href={`/article/${article.slug}`}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-bg rounded-xl"
        aria-label={`Read featured: "${article.title}"`}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-10 items-center bg-bg-elevated rounded-xl border border-border-light overflow-hidden transition-shadow duration-slow group-hover:shadow-xl">
          {/* ── Left: Image ──────────────────────────────── */}
          <div className="md:col-span-7 relative aspect-[16/10] md:aspect-auto md:h-full min-h-[240px] md:min-h-[380px] bg-surface overflow-hidden">
            {article.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.coverImageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-slower ease-out-expo group-hover:scale-[1.03]"
              />
            ) : (
              /* Beautifully layered gradient placeholder */
              <div className="absolute inset-0" aria-hidden="true">
                {/* Base gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${article.category.color}18 0%, ${article.category.color}06 60%, transparent 100%)`,
                  }}
                />
                {/* Decorative geometric shapes */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Large circle */}
                  <div
                    className="absolute w-64 h-64 rounded-full opacity-[0.06]"
                    style={{
                      background: `radial-gradient(circle, ${article.category.color} 0%, transparent 70%)`,
                      top: "15%",
                      right: "10%",
                    }}
                  />
                  {/* Small accent circle */}
                  <div
                    className="absolute w-20 h-20 rounded-full opacity-[0.08]"
                    style={{
                      backgroundColor: article.category.color,
                      bottom: "20%",
                      left: "15%",
                    }}
                  />
                  {/* Diagonal line */}
                  <div
                    className="absolute w-px h-48 opacity-[0.08] rotate-[30deg]"
                    style={{ backgroundColor: article.category.color, left: "40%" }}
                  />
                </div>
                {/* Document icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-16 h-16 text-text-tertiary/20"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={0.75}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Category badge — absolute over image */}
            <div className="absolute top-4 left-4 z-10">
              <span
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium font-body backdrop-blur-md"
                style={{
                  backgroundColor: `${article.category.color}22`,
                  color: article.category.color,
                  border: `1px solid ${article.category.color}30`,
                }}
              >
                {article.category.name}
              </span>
            </div>
          </div>

          {/* ── Right: Editorial Text ────────────────────── */}
          <div className="md:col-span-5 p-6 md:p-0 md:pr-10 md:py-10 flex flex-col justify-center">
            {/* Kicker label */}
            <span className="text-xs font-medium font-body uppercase tracking-widest text-accent mb-4 block">
              Featured Story
            </span>

            {/* Title */}
            <h3 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight leading-tight mb-4 group-hover:text-accent transition-colors duration-normal">
              {article.title}
            </h3>

            {/* Excerpt */}
            <p className="font-body text-text-secondary text-base leading-relaxed mb-6 line-clamp-3">
              {article.excerpt}
            </p>

            {/* Author + Meta */}
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {article.author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.author.avatarUrl}
                  alt={article.author.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-xs font-medium text-text-secondary"
                  aria-hidden="true"
                >
                  {getInitials(article.author.name)}
                </div>
              )}

              <div className="font-body text-sm">
                <span className="font-medium text-text">{article.author.name}</span>
                <div className="flex items-center gap-1.5 text-xs text-text-tertiary mt-0.5">
                  <time dateTime={article.publishedAt}>
                    {formatDate(article.publishedAt)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span>{article.readTimeMinutes} min read</span>
                </div>
              </div>
            </div>

            {/* Read more arrow */}
            <div className="mt-6 flex items-center gap-2 text-sm font-medium text-accent group-hover:gap-3 transition-all duration-normal">
              <span>Read the full story</span>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
