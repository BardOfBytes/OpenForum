"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { PenSquare, UserPlus } from "lucide-react";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { FollowButton } from "@/components/authors/FollowButton";
import type { ArticleListItem } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

interface PublicAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  followerCount: number;
  isFollowing: boolean;
  createdAt: string | null;
  articles: ArticleListItem[];
  totalReadTime: number;
  totalViews: number;
  primaryCategory: string | null;
}

interface PublicAuthorProfileExperienceProps {
  author: PublicAuthor;
  sessionToken: string | null;
}

type AuthorTab = "published" | "drafts";

export function PublicAuthorProfileExperience({
  author,
  sessionToken,
}: PublicAuthorProfileExperienceProps) {
  const [activeTab, setActiveTab] = useState<AuthorTab>("published");
  const initials = author.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const joinedLabel = formatJoinedDate(author.createdAt);

  return (
    <main className="flex-grow">
      <section className="container mx-auto max-w-4xl px-4 py-12 md:px-8">
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-start md:text-left">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card font-serif text-3xl font-medium text-primary md:h-40 md:w-40">
            {author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <div className="flex-1">
            <h1 className="mb-3 font-serif text-4xl font-medium tracking-normal text-foreground md:text-5xl">
              {author.name}
            </h1>
            <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
              <span className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                {author.headline || "OpenForum Author"}
              </span>
              {author.primaryCategory ? (
                <>
                  <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/60 sm:block" />
                  <span className="text-sm text-muted-foreground">
                    {author.primaryCategory}
                  </span>
                </>
              ) : null}
              {joinedLabel ? (
                <>
                  <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/60 sm:block" />
                  <span className="text-sm text-muted-foreground">{joinedLabel}</span>
                </>
              ) : null}
            </div>
            <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:mx-0">
              {author.bio ||
                "Read published stories, essays, and reporting from this OpenForum contributor."}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 border-y border-border py-6 md:justify-start md:gap-8">
              <AuthorStat label="Articles" value={author.articles.length} />
              <div className="h-10 w-px bg-border" />
              <AuthorStat label="Views" value={author.totalViews} />
              <div className="hidden h-10 w-px bg-border sm:block" />
              <div className="hidden sm:block">
                <AuthorStat label="Followers" value={author.followerCount} />
              </div>
            </div>

            <div className="mt-7 flex justify-center md:justify-start">
              <FollowButton
                authorId={author.id}
                sessionToken={sessionToken}
                initialFollowing={author.isFollowing}
                initialFollowerCount={author.followerCount}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto mb-24 max-w-6xl px-4 md:px-8">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-border">
          <div className="flex items-center gap-8">
            <AuthorTabButton
              active={activeTab === "published"}
              onClick={() => setActiveTab("published")}
            >
              Published
            </AuthorTabButton>
            <AuthorTabButton
              active={activeTab === "drafts"}
              onClick={() => setActiveTab("drafts")}
            >
              Drafts
            </AuthorTabButton>
          </div>

          <Link
            href={ROUTES.articles}
            className="mb-3 hidden shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted md:inline-flex"
          >
            <PenSquare className="h-4 w-4" />
            Browse all
          </Link>
        </div>

        {activeTab === "published" ? (
          author.articles.length > 0 ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {author.articles.map((article, index) => (
                <ArticleCard key={article.slug} article={article} index={index} />
              ))}
            </div>
          ) : (
            <EmptyAuthorPanel
              title="No public articles yet"
              description="This author has a profile, but no published OpenForum articles are visible yet."
            />
          )
        ) : null}

        {activeTab === "drafts" ? (
          <EmptyAuthorPanel
            title="Sign in required"
            description="You can only view your own drafts."
            actionHref={ROUTES.login}
            actionLabel="Sign in"
          />
        ) : null}
      </section>
    </main>
  );
}

function formatJoinedDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }

  try {
    return `Joined ${new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
    }).format(new Date(iso))}`;
  } catch {
    return null;
  }
}

function AuthorTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative py-4 text-sm font-semibold uppercase tracking-[0.18em] transition-colors hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
      <span
        className={`absolute inset-x-0 bottom-0 h-0.5 bg-primary transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </button>
  );
}

function AuthorStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="font-serif text-3xl font-medium text-foreground">
        {value}
      </span>
      <span className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function EmptyAuthorPanel({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-8 py-24 text-center">
      <h3 className="font-serif text-2xl font-medium text-foreground">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
