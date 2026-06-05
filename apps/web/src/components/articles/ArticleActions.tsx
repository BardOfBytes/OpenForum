"use client";

import { Bookmark, Check, Copy, Heart, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api/base-url";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

interface ArticleActionsProps {
  slug: string;
  title: string;
  initialLikeState?: SocialState;
  initialBookmarkState?: SocialState;
}

type ActionKind = "like" | "bookmark";

interface SocialState {
  active: boolean;
  count: number;
}

export function ArticleActions({
  slug,
  title,
  initialLikeState,
  initialBookmarkState,
}: ArticleActionsProps) {
  const [copied, setCopied] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [likeState, setLikeState] = useState<SocialState>(
    initialLikeState ?? { active: false, count: 0 }
  );
  const [bookmarkState, setBookmarkState] = useState<SocialState>({
    active: initialBookmarkState?.active ?? false,
    count: initialBookmarkState?.count ?? 0,
  });

  async function copyLink() {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function shareArticle() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or platform rejected; keep the fallback available.
      }
    }

    await copyLink();
  }

  async function getAccessToken(): Promise<string | null> {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function toggleSocial(kind: ActionKind) {
    setAuthRequired(false);
    setPending(kind);

    try {
      const token = await getAccessToken();
      if (!token) {
        setAuthRequired(true);
        return;
      }

      const current = kind === "like" ? likeState : bookmarkState;
      const endpoint =
        kind === "like"
          ? `/api/v1/articles/${slug}/likes`
          : `/api/v1/articles/${slug}/bookmarks`;

      const response = await fetch(apiUrl(endpoint), {
        method: current.active ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await response.json().catch(() => null)) as SocialState | null;
      if (!response.ok || !body) {
        throw new Error("Social action failed");
      }

      if (kind === "like") {
        setLikeState(body);
      } else {
        setBookmarkState(body);
      }
    } catch {
      setAuthRequired(true);
    } finally {
      setPending(null);
    }
  }

  const actionButtonClass =
    "inline-flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text disabled:cursor-wait disabled:opacity-70";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggleSocial("like")}
          disabled={pending === "like"}
          className={actionButtonClass}
          aria-pressed={likeState.active}
        >
          {pending === "like" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Heart
              className={likeState.active ? "h-4 w-4 fill-accent text-accent" : "h-4 w-4"}
            />
          )}
          {likeState.count > 0 ? likeState.count : "Like"}
        </button>
        <button
          type="button"
          onClick={() => toggleSocial("bookmark")}
          disabled={pending === "bookmark"}
          className={actionButtonClass}
          aria-pressed={bookmarkState.active}
        >
          {pending === "bookmark" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bookmark
              className={
                bookmarkState.active ? "h-4 w-4 fill-accent text-accent" : "h-4 w-4"
              }
            />
          )}
          {bookmarkState.count > 0
            ? `${bookmarkState.active ? "Saved" : "Save"} · ${bookmarkState.count}`
            : bookmarkState.active
              ? "Saved"
              : "Save"}
        </button>
        <button
          type="button"
          onClick={copyLink}
          className={actionButtonClass}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={shareArticle}
          className={actionButtonClass}
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
      {authRequired && (
        <p className="font-body text-xs text-text-tertiary">
          Sign in with your CSVTu account to like or save articles.{" "}
          <Link
            href={`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.article.detail(slug))}`}
            className="font-medium text-accent hover:text-accent-hover"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
