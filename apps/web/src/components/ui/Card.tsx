/**
 * ArticleCard Component — OpenForum Design System
 *
 * Magazine-style article preview card with:
 * - Cover image with subtle zoom-on-hover
 * - Category badge (color-coded)
 * - Article title (Fraunces serif)
 * - Excerpt (2-line clamp)
 * - Author avatar + name + read time footer
 * - Framer Motion fade-up entrance + hover lift
 *
 * Designed for the asymmetric editorial grid on the feed page.
 * The card uses warm shadows and rounded corners that echo the
 * papery aesthetic of the rest of the design system.
 *
 * @example
 * ```tsx
 * <ArticleCard
 *   title="The Silent Protest at CSVTU"
 *   excerpt="What happened when students stood in the rain..."
 *   slug="the-silent-protest-at-csvtu"
 *   coverImageUrl="/images/protest.jpg"
 *   category={{ name: "Investigation", color: "#d4613c" }}
 *   author={{ name: "Priya Sharma", avatarUrl: "/avatars/priya.jpg" }}
 *   readTimeMinutes={7}
 *   publishedAt="2026-04-10T12:00:00Z"
 * />
 * ```
 */

"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────── */

interface ArticleCardAuthor {
  name: string;
  avatarUrl: string | null;
}

interface ArticleCardCategory {
  name: string;
  /** Hex color for the badge background tint. */
  color?: string;
}

interface ArticleCardProps {
  /** Article title — rendered in Fraunces serif. */
  title: string;
  /** Short excerpt (1–2 sentences). */
  excerpt: string;
  /** URL slug for the article link. */
  slug: string;
  /** Cover image URL. Falls back to a gradient placeholder. */
  coverImageUrl?: string | null;
  /** Category badge data. */
  category: ArticleCardCategory;
  /** Author details for the footer. */
  author: ArticleCardAuthor;
  /** Estimated reading time in minutes. */
  readTimeMinutes: number;
  /** ISO 8601 publication date. */
  publishedAt: string;
  /** Card layout variant. Default: "vertical". */
  variant?: "vertical" | "horizontal";
  /** Whether this is a featured (large) card. */
  featured?: boolean;
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────── */

/** Format an ISO date string to a human-readable format. */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Generate initials for the avatar fallback. */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─────────────────────────────────────────────────────────────
   FRAMER MOTION PRESETS
   ───────────────────────────────────────────────────────────── */

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

/* ─────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────── */

export function ArticleCard({
  title,
  excerpt,
  slug,
  coverImageUrl,
  category,
  author,
  readTimeMinutes,
  publishedAt,
  variant = "vertical",
  featured = false,
}: ArticleCardProps) {
  const isHorizontal = variant === "horizontal";

  return (
    <motion.article
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      className="group"
    >
      <Link
        href={`/article/${slug}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-bg rounded-xl"
        aria-label={`Read "${title}" by ${author.name}`}
      >
        <div
          className={[
            "overflow-hidden rounded-xl",
            "bg-bg-elevated",
            "border border-border-light",
            "transition-shadow duration-slow ease-out-expo",
            "group-hover:shadow-lg",
            isHorizontal ? "flex flex-row" : "flex flex-col",
          ].join(" ")}
        >
          {/* ── Cover Image ─────────────────────────────────── */}
          <div
            className={[
              "relative overflow-hidden",
              "bg-surface",
              isHorizontal
                ? "w-2/5 min-h-[180px] shrink-0"
                : featured
                  ? "aspect-[16/10]"
                  : "aspect-[16/11]",
            ].join(" ")}
          >
            {coverImageUrl ? (
              <Image
                src={coverImageUrl}
                alt=""
                fill
                sizes={
                  featured
                    ? "(max-width: 768px) 100vw, 60vw"
                    : "(max-width: 768px) 100vw, 33vw"
                }
                className="object-cover transition-transform duration-slower ease-out-expo group-hover:scale-[1.04]"
              />
            ) : (
              /* Gradient placeholder when no cover image */
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${category.color ?? "var(--color-accent)"}22, ${category.color ?? "var(--color-accent)"}08)`,
                }}
                aria-hidden="true"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-text-tertiary/30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Category Badge — positioned over the image */}
            <div className="absolute top-3 left-3 z-10">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium font-body backdrop-blur-md"
                style={{
                  backgroundColor: `${category.color ?? "var(--color-accent)"}18`,
                  color: category.color ?? "var(--color-accent)",
                  border: `1px solid ${category.color ?? "var(--color-accent)"}25`,
                }}
              >
                {category.name}
              </span>
            </div>
          </div>

          {/* ── Content ─────────────────────────────────────── */}
          <div
            className={[
              "flex flex-col justify-between",
              isHorizontal ? "p-5 min-w-0" : "p-5",
              featured ? "p-6 md:p-8" : "",
            ].join(" ")}
          >
            {/* Title */}
            <div>
              <h3
                className={[
                  "font-heading font-semibold text-text leading-snug tracking-tight",
                  "transition-colors duration-fast group-hover:text-accent",
                  featured
                    ? "text-xl md:text-2xl mb-3"
                    : "text-lg mb-2",
                ].join(" ")}
              >
                {title}
              </h3>

              {/* Excerpt */}
              <p
                className={[
                  "font-body text-text-secondary leading-relaxed line-clamp-2",
                  featured ? "text-base mb-5" : "text-sm mb-4",
                ].join(" ")}
              >
                {excerpt}
              </p>
            </div>

            {/* ── Footer: Author + Meta ──────────────────────── */}
            <div className="flex items-center gap-3 pt-3 border-t border-border-light">
              {/* Author Avatar */}
              <div className="relative shrink-0">
                {author.avatarUrl ? (
                  <Image
                    src={author.avatarUrl}
                    alt={author.name}
                    width={28}
                    height={28}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-xs font-medium text-text-secondary"
                    aria-hidden="true"
                  >
                    {getInitials(author.name)}
                  </div>
                )}
              </div>

              {/* Author Name + Read Time */}
              <div className="min-w-0 flex-1 flex items-center gap-1.5 text-xs text-text-secondary font-body">
                <span className="font-medium text-text truncate">
                  {author.name}
                </span>
                <span className="text-text-tertiary" aria-hidden="true">·</span>
                <time
                  dateTime={publishedAt}
                  className="shrink-0 text-text-tertiary"
                >
                  {formatDate(publishedAt)}
                </time>
                <span className="text-text-tertiary" aria-hidden="true">·</span>
                <span className="shrink-0 text-text-tertiary">
                  {readTimeMinutes} min read
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
