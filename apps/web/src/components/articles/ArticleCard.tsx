"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Eye } from "lucide-react";
import { AuthorBadge } from "@/components/articles/AuthorBadge";
import type { ArticleListItem } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

interface ArticleCardProps {
  article: ArticleListItem;
  featured?: boolean;
  className?: string;
  index?: number;
  variant?: "default" | "horizontal";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formattedDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function joinClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function ArticleCard({
  article,
  featured = false,
  className,
  index = 0,
  variant = "default",
}: ArticleCardProps) {
  const readTime = `${article.readTimeMinutes || 1} min read`;
  const href = ROUTES.article.detail(article.slug);
  const views = "views" in article && typeof article.views === "number" ? article.views : null;

  if (variant === "horizontal") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.07 }}
        className={joinClasses(
          "group flex gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
          className
        )}
      >
        <Link href={href} className="flex w-full gap-4">
          {article.coverImageUrl && (
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.coverImageUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          )}
          <div className="min-w-0 flex-grow">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-primary">
              {article.category.name}
            </span>
            <h3 className="mb-1.5 line-clamp-2 font-serif text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
              {article.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">{article.author.name}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {readTime}
              </span>
              {views !== null ? (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {views.toLocaleString("en-IN")}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div className="self-center text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={joinClasses(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg",
        className
      )}
    >
      <Link href={href} className="flex h-full flex-col">
        {article.coverImageUrl ? (
          <div className={featured ? "h-64 w-full flex-shrink-0 overflow-hidden bg-muted" : "h-44 w-full flex-shrink-0 overflow-hidden bg-muted"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.coverImageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className="h-1.5 w-full flex-shrink-0 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent"
            style={{
              background: `linear-gradient(90deg, ${article.category.color} 0%, ${article.category.color}66 55%, transparent 100%)`,
            }}
          />
        )}

        <div className="flex flex-grow flex-col p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {article.category.name}
            </span>
            {featured && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Featured
              </span>
            )}
          </div>

          <div className="flex-grow">
            <h3
              className={joinClasses(
                "mb-2.5 font-serif font-semibold leading-tight text-foreground transition-colors group-hover:text-primary",
                featured ? "text-2xl md:text-3xl" : "text-lg md:text-xl"
              )}
            >
              {article.title}
            </h3>
            <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {article.excerpt}
            </p>
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
            <AuthorBadge
              name={article.author.name}
              avatarFallback={initials(article.author.name) || "OF"}
              avatarUrl={article.author.avatarUrl}
              date={formattedDate(article.publishedAt)}
              readTime={readTime}
            />
            <span className="flex-shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
