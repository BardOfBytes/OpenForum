"use client";

import { Edit3, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api/base-url";
import type { ArticleDetail } from "@/lib/api/articles";
import { getCategoryBySlug, categorySlugFromName } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

interface ArticleManagementProps {
  article: ArticleDetail;
}

interface EditableArticle {
  title: string;
  excerpt: string;
  body: string;
  categoryName: string;
  tags: string;
  status: string;
}

function roleCanManageAll(role: unknown): boolean {
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

export function ArticleManagement({ article }: ArticleManagementProps) {
  const router = useRouter();
  const [canManage, setCanManage] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableArticle>({
    title: article.title,
    excerpt: article.excerpt,
    body: article.body,
    categoryName: article.category.name,
    tags: article.tags.join(", "),
    status: "Published",
  });

  const knownCategory = useMemo(
    () => getCategoryBySlug(categorySlugFromName(draft.categoryName)),
    [draft.categoryName]
  );

  useEffect(() => {
    let active = true;

    async function resolveAccess() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        const user = session?.user;
        const isAuthor = Boolean(article.author.id && user?.id === article.author.id);

        if (active) {
          setToken(session?.access_token ?? null);
          setCanManage(
            Boolean(session?.access_token && (isAuthor || roleCanManageAll(userRole(user))))
          );
        }
      } catch {
        if (active) {
          setCanManage(false);
          setToken(null);
        }
      }
    }

    resolveAccess();

    return () => {
      active = false;
    };
  }, [article.author.id]);

  if (!canManage) {
    return null;
  }

  async function saveArticle() {
    if (!token) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/v1/articles/${article.slug}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: draft.title.trim(),
          excerpt: draft.excerpt.trim(),
          body: draft.body,
          category_name: draft.categoryName.trim(),
          tags: draft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          status: draft.status,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to save article.");
      }

      setEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save article.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteArticle() {
    if (!token) return;
    const confirmed = window.confirm("Delete this article permanently?");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/v1/articles/${article.slug}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to delete article.");
      }

      router.push(ROUTES.articles);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete article.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mb-10 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Article controls
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage title, summary, category, tags, and publication state.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${ROUTES.write}?slug=${encodeURIComponent(article.slug)}`}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Edit3 className="h-4 w-4" />
            Open editor
          </Link>
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {editing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={deleteArticle}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1 text-sm text-muted-foreground">
            Title
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Excerpt
            <textarea
              value={draft.excerpt}
              onChange={(event) =>
                setDraft((current) => ({ ...current, excerpt: event.target.value }))
              }
              rows={3}
              className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Body HTML
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              rows={8}
              className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1 text-sm text-muted-foreground">
              Category
              <input
                value={draft.categoryName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, categoryName: event.target.value }))
                }
                className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {!knownCategory && (
                <span className="text-xs text-muted-foreground">Unknown category uses default color.</span>
              )}
            </label>
            <label className="grid gap-1 text-sm text-muted-foreground">
              Tags
              <input
                value={draft.tags}
                onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="grid gap-1 text-sm text-muted-foreground">
              Status
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveArticle}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
