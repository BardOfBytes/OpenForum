"use client";

import {
  Bookmark,
  Check,
  Copy,
  Heart,
  Link as LinkIcon,
  Loader2,
  Share2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Inline X (formerly Twitter) glyph — lucide-react no longer ships a brand icon. */
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [pending, setPending] = useState<ActionKind | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const [likeState, setLikeState] = useState<SocialState>(
    initialLikeState ?? { active: false, count: 0 }
  );
  const [bookmarkState, setBookmarkState] = useState<SocialState>({
    active: initialBookmarkState?.active ?? false,
    count: initialBookmarkState?.count ?? 0,
  });

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (!shareOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setShareOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [shareOpen]);

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
        // User cancelled or platform rejected; fall back to the popover.
      }
    }

    setShareOpen((open) => !open);
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
    "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-foreground/20 hover:text-foreground disabled:cursor-wait disabled:opacity-70";

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
              className={likeState.active ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"}
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
                bookmarkState.active ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"
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
        <div className="relative" ref={shareRef}>
          <button
            type="button"
            onClick={shareArticle}
            className={actionButtonClass}
            aria-haspopup="menu"
            aria-expanded={shareOpen}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          {shareOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-card py-2 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  copyLink();
                  setShareOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                )}
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  title
                )}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setShareOpen(false)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <XIcon className="h-4 w-4 text-muted-foreground" />
                Share on X
              </a>
            </div>
          )}
        </div>
      </div>
      {authRequired && (
        <p className="text-xs text-muted-foreground">
          Sign in with your CSVTu account to like or save articles.{" "}
          <Link
            href={`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.article.detail(slug))}`}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
