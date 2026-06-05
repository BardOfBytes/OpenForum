"use client";

import { Edit3, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
        const role = user?.app_metadata?.role ?? user?.app_metadata?.user_role;
        const isAuthor = Boolean(article.author.id && user?.id === article.author.id);

        if (active) {
          setToken(session?.access_token ?? null);
          setCanManage(Boolean(session?.access_token && (isAuthor || roleCanManageAll(role))));
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
    <section className="mb-8 border-y border-border-light bg-surface/45 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-widest text-text-tertiary">
            Article controls
          </p>
          <p className="font-body text-sm text-text-secondary">
            Manage title, summary, category, tags, and publication state.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-bg-elevated"
          >
            {editing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={deleteArticle}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10 disabled:cursor-wait disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1 font-body text-sm text-text-secondary">
            Title
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text outline-none focus:border-accent"
            />
          </label>
          <label className="grid gap-1 font-body text-sm text-text-secondary">
            Excerpt
            <textarea
              value={draft.excerpt}
              onChange={(event) =>
                setDraft((current) => ({ ...current, excerpt: event.target.value }))
              }
              rows={3}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text outline-none focus:border-accent"
            />
          </label>
          <label className="grid gap-1 font-body text-sm text-text-secondary">
            Body HTML
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              rows={8}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1 font-body text-sm text-text-secondary">
              Category
              <input
                value={draft.categoryName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, categoryName: event.target.value }))
                }
                className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text outline-none focus:border-accent"
              />
              {!knownCategory && (
                <span className="text-xs text-text-tertiary">Unknown category uses default color.</span>
              )}
            </label>
            <label className="grid gap-1 font-body text-sm text-text-secondary">
              Tags
              <input
                value={draft.tags}
                onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text outline-none focus:border-accent"
              />
            </label>
            <label className="grid gap-1 font-body text-sm text-text-secondary">
              Status
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text outline-none focus:border-accent"
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
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
            {error && <p className="font-body text-sm text-error">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
