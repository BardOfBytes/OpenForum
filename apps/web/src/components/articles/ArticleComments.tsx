"use client";

import Link from "next/link";
import { Edit3, EyeOff, Loader2, MessageCircle, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api/base-url";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

interface ArticleCommentsProps {
  slug: string;
}

interface ApiComment {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
}

function formatCommentDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
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

function roleCanModerateComments(role: unknown): boolean {
  return role === "editor" || role === "admin";
}

function userRole(
  user: { app_metadata?: Record<string, unknown>; user_role?: unknown } | null | undefined
): unknown {
  return (
    user?.app_metadata?.role ??
    user?.app_metadata?.user_role ??
    (user as { user_role?: unknown } | undefined)?.user_role
  );
}

export function ArticleComments({ slug }: ArticleCommentsProps) {
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);

  const signInHref = useMemo(
    () => `${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.article.detail(slug))}`,
    [slug]
  );

  useEffect(() => {
    let active = true;

    async function loadComments() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(apiUrl(`/api/v1/articles/${slug}/comments`));
        if (!response.ok) {
          throw new Error("Unable to load comments.");
        }
        const nextComments = (await response.json()) as ApiComment[];
        if (active) {
          setComments(nextComments);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load comments.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadComments();

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (active) {
          const session = data.session;
          setCurrentUserId(session?.user.id ?? null);
          setSessionToken(session?.access_token ?? null);
          setCanModerate(roleCanModerateComments(userRole(session?.user)));
        }
      } catch {
        if (active) {
          setCurrentUserId(null);
          setSessionToken(null);
          setCanModerate(false);
        }
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function submitComment() {
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }

    setSubmitting(true);
    setAuthRequired(false);
    setError(null);

    try {
      let token = sessionToken;
      if (!token) {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        token = session?.access_token ?? null;
        setCurrentUserId(session?.user.id ?? null);
        setSessionToken(token);
        setCanModerate(roleCanModerateComments(userRole(session?.user)));
      }

      if (!token) {
        setAuthRequired(true);
        return;
      }

      const response = await fetch(apiUrl(`/api/v1/articles/${slug}/comments`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: trimmed, parent_id: null }),
      });

      if (!response.ok) {
        throw new Error("Unable to post comment.");
      }

      const comment = (await response.json()) as ApiComment;
      setComments((current) => [...current, comment]);
      setBody("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(comment: ApiComment) {
    setEditingId(comment.id);
    setEditingBody(comment.body);
    setError(null);
  }

  async function saveComment(commentId: string) {
    const trimmed = editingBody.trim();
    if (!trimmed || !sessionToken) {
      return;
    }

    setPendingCommentId(commentId);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/v1/comments/${commentId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ body: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Unable to update comment.");
      }

      const updated = (await response.json()) as ApiComment;
      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? updated : comment))
      );
      setEditingId(null);
      setEditingBody("");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update comment.");
    } finally {
      setPendingCommentId(null);
    }
  }

  async function hideComment(commentId: string) {
    if (!sessionToken) {
      return;
    }

    const confirmed = window.confirm("Hide this comment from public view?");
    if (!confirmed) {
      return;
    }

    setPendingCommentId(commentId);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/v1/comments/${commentId}/moderation/hide`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to hide comment.");
      }

      setComments((current) => current.filter((comment) => comment.id !== commentId));
      if (editingId === commentId) {
        setEditingId(null);
        setEditingBody("");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to hide comment.");
    } finally {
      setPendingCommentId(null);
    }
  }

  async function deleteComment(commentId: string, asModerator: boolean) {
    if (!sessionToken) {
      return;
    }

    const confirmed = window.confirm(
      asModerator ? "Delete this comment as a moderator?" : "Delete this comment?"
    );
    if (!confirmed) {
      return;
    }

    setPendingCommentId(commentId);
    setError(null);

    try {
      const endpoint = asModerator
        ? `/api/v1/comments/${commentId}/moderation`
        : `/api/v1/comments/${commentId}`;
      const response = await fetch(apiUrl(endpoint), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to delete comment.");
      }

      setComments((current) => current.filter((comment) => comment.id !== commentId));
      if (editingId === commentId) {
        setEditingId(null);
        setEditingBody("");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete comment.");
    } finally {
      setPendingCommentId(null);
    }
  }

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-medium tracking-normal text-foreground">
            Comments
          </h2>
          <p className="text-sm text-muted-foreground">
            Public responses from the OpenForum community.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          {comments.length}
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-border bg-card p-5">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          placeholder="Add a thoughtful response..."
          className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Keep it specific, respectful, and useful for readers.
          </p>
          <button
            type="button"
            onClick={submitComment}
            disabled={submitting || !body.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post comment
          </button>
        </div>
        {authRequired && (
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with your CSVTu account to comment.{" "}
            <Link href={signInHref} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading comments
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-5">
          {comments.map((comment) => (
            <article key={comment.id} className="grid grid-cols-[40px_1fr] gap-3">
              {comment.author_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comment.author_avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground">
                  {initials(comment.author_name) || "OF"}
                </div>
              )}
              <div className="border-b border-border pb-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {comment.author_name}
                    </h3>
                    <time
                      dateTime={comment.created_at}
                      className="text-xs text-muted-foreground"
                    >
                      {formatCommentDate(comment.created_at)}
                    </time>
                  </div>
                  {(currentUserId === comment.author_id || canModerate) && (
                    <div className="flex items-center gap-1">
                      {currentUserId === comment.author_id && (
                        <button
                          type="button"
                          onClick={() =>
                            editingId === comment.id
                              ? (setEditingId(null), setEditingBody(""))
                              : startEditing(comment)
                          }
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {editingId === comment.id ? (
                            <X className="h-3.5 w-3.5" />
                          ) : (
                            <Edit3 className="h-3.5 w-3.5" />
                          )}
                          {editingId === comment.id ? "Cancel" : "Edit"}
                        </button>
                      )}
                      {canModerate && (
                        <button
                          type="button"
                          onClick={() => hideComment(comment.id)}
                          disabled={pendingCommentId === comment.id}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-60"
                        >
                          {pendingCommentId === comment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                          Hide
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteComment(comment.id, canModerate)}
                        disabled={pendingCommentId === comment.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-60"
                      >
                        {pendingCommentId === comment.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div className="mt-3">
                    <textarea
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => saveComment(comment.id)}
                      disabled={pendingCommentId === comment.id || !editingBody.trim()}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
                    >
                      {pendingCommentId === comment.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Save comment
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {comment.body}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card px-6 py-8">
          <p className="text-sm text-muted-foreground">
            No comments yet. Start the discussion with a specific response.
          </p>
        </div>
      )}
    </section>
  );
}
