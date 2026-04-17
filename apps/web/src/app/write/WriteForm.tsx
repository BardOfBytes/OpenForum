"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";
import ArticleEditor from "@/components/editor/ArticleEditor";
import { Button } from "@/components/ui/Button";
import { ApiBaseUrlConfigurationError, apiUrl } from "@/lib/api/base-url";
import { CATEGORY_CATALOG } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

const CATEGORIES = CATEGORY_CATALOG.map((category) => category.name);
const LEGACY_DRAFT_BODY_KEY = "draft_article_body";
const DRAFT_KEY_PREFIX = "openforum_draft_";
const MAX_CHARACTERS = 10000;
const ALLOWED_YOUTUBE_EMBED_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "m.youtube.com",
]);

interface StoredDraft {
  draftId: string;
  title: string;
  body: string;
  tags: string[];
  category: string;
  excerpt: string;
  savedAt: string;
}

interface RestoreDraft extends StoredDraft {
  storageKey: string;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function isEditorContentEmpty(html: string): boolean {
  if (typeof document === "undefined") {
    const plainText = stripHtmlToText(html).replace(/\u00a0/g, " ").trim();
    const hasMedia = /<(img|iframe)\b[^>]*>/i.test(html);
    return plainText.length === 0 && !hasMedia;
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;
  const plainText = (temp.textContent || temp.innerText || "")
    .replace(/\u00a0/g, " ")
    .trim();

  return plainText.length === 0 && !temp.querySelector("img, iframe");
}

function isAllowedYoutubeEmbedSrc(value: string): boolean {
  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();

    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }

    if (!ALLOWED_YOUTUBE_EMBED_HOSTS.has(host)) {
      return false;
    }

    return parsed.pathname.startsWith("/embed/");
  } catch {
    return false;
  }
}

function sanitizeArticleBody(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["iframe"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "frameborder",
      "height",
      "loading",
      "referrerpolicy",
      "src",
      "title",
      "width",
    ],
  });

  if (typeof document === "undefined") {
    return sanitized;
  }

  const temp = document.createElement("div");
  temp.innerHTML = sanitized;

  temp.querySelectorAll("iframe").forEach((iframe) => {
    const src = iframe.getAttribute("src")?.trim() ?? "";

    if (!isAllowedYoutubeEmbedSrc(src)) {
      iframe.remove();
      return;
    }

    iframe.setAttribute("src", src);
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.setAttribute("allowfullscreen", "true");

    // Defensively strip inline event attributes from embeds.
    Array.from(iframe.attributes).forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith("on")) {
        iframe.removeAttribute(attribute.name);
      }
    });
  });

  return temp.innerHTML;
}

function buildExcerptFromHtml(html: string, maxLen = 150): string {
  if (typeof document === "undefined") {
    const textContent = stripHtmlToText(html);

    if (textContent.length <= maxLen) {
      return textContent;
    }

    const truncated = textContent.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(" ");
    const safeBoundary = lastSpace > 0 ? lastSpace : maxLen;
    return `${truncated.slice(0, safeBoundary)}...`;
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;
  const textContent = (temp.textContent || temp.innerText || "")
    .replace(/\s+/g, " ")
    .trim();

  if (textContent.length <= maxLen) {
    return textContent;
  }

  const truncated = textContent.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  const safeBoundary = lastSpace > 0 ? lastSpace : maxLen;
  return `${truncated.slice(0, safeBoundary)}...`;
}

function extractFirstImageUrl(html: string): string | null {
  if (typeof document === "undefined") {
    const match = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    const src = match?.[1]?.trim();

    if (!src) {
      return null;
    }

    try {
      const parsed = new URL(src);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return src;
      }
    } catch {
      return null;
    }

    return null;
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;
  const src = temp.querySelector("img")?.getAttribute("src")?.trim();

  if (!src) {
    return null;
  }

  try {
    const parsed = new URL(src);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return src;
    }
  } catch {
    return null;
  }

  return null;
}

function createDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getPlainTextFromHtml(html: string): string {
  if (typeof document === "undefined") {
    return stripHtmlToText(html).replace(/\u00a0/g, " ").trim();
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;
  return (temp.textContent || temp.innerText || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDraftTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseStoredDraft(raw: string | null, storageKey: string): RestoreDraft | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (!parsed?.draftId || typeof parsed.body !== "string") {
      return null;
    }

    return {
      draftId: parsed.draftId,
      title: parsed.title ?? "",
      body: parsed.body,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean).slice(0, 5) : [],
      category:
        parsed.category && CATEGORIES.includes(parsed.category)
          ? parsed.category
          : "Campus News",
      excerpt: parsed.excerpt ?? "",
      savedAt: parsed.savedAt ?? new Date().toISOString(),
      storageKey,
    };
  } catch {
    return null;
  }
}

function findLatestDraftInStorage(): RestoreDraft | null {
  const drafts: RestoreDraft[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) {
      continue;
    }

    const parsed = parseStoredDraft(localStorage.getItem(key), key);
    if (parsed) {
      drafts.push(parsed);
    }
  }

  drafts.sort((a, b) => {
    const aTime = new Date(a.savedAt).getTime();
    const bTime = new Date(b.savedAt).getTime();
    return bTime - aTime;
  });

  return drafts[0] ?? null;
}

export default function WriteForm({ sessionToken }: { sessionToken: string }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [category, setCategory] = useState("Campus News");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialContent, setInitialContent] = useState("");
  const [editorRenderKey, setEditorRenderKey] = useState(0);
  const [draftId, setDraftId] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [restoreDraftToast, setRestoreDraftToast] = useState<RestoreDraft | null>(null);

  useEffect(() => {
    const latestDraft = findLatestDraftInStorage();

    if (latestDraft) {
      setDraftId(latestDraft.draftId);
      setDraftSavedAt(latestDraft.savedAt);
      setRestoreDraftToast(latestDraft);
      return;
    }

    const legacyBody = localStorage.getItem(LEGACY_DRAFT_BODY_KEY);
    if (legacyBody && !isEditorContentEmpty(legacyBody)) {
      const legacyDraftId = createDraftId();
      const savedAt = new Date().toISOString();
      setDraftId(legacyDraftId);
      setDraftSavedAt(savedAt);
      setRestoreDraftToast({
        draftId: legacyDraftId,
        title: "",
        body: legacyBody,
        tags: [],
        category: "Campus News",
        excerpt: buildExcerptFromHtml(legacyBody),
        savedAt,
        storageKey: LEGACY_DRAFT_BODY_KEY,
      });
      return;
    }

    setDraftId(createDraftId());
  }, []);

  useEffect(() => {
    if (!draftId || isSubmitting) {
      return;
    }

    const interval = window.setInterval(() => {
      const excerpt = buildExcerptFromHtml(contentHtml);
      const shouldSaveDraft =
        title.trim().length > 0 ||
        !isEditorContentEmpty(contentHtml) ||
        tags.length > 0 ||
        excerpt.length > 0;

      if (!shouldSaveDraft) {
        return;
      }

      const payload: StoredDraft = {
        draftId,
        title: title.trim(),
        body: contentHtml,
        tags,
        category,
        excerpt,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(`${DRAFT_KEY_PREFIX}${draftId}`, JSON.stringify(payload));
      setDraftSavedAt(payload.savedAt);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [draftId, isSubmitting, title, contentHtml, tags, category]);

  const { wordCount, characterCount, readTimeMinutes } = useMemo(() => {
    const plainText = getPlainTextFromHtml(contentHtml);
    const words = plainText.length > 0 ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const characters = plainText.length;

    return {
      wordCount: words,
      characterCount: characters,
      readTimeMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 200)),
    };
  }, [contentHtml]);

  const restoreDraftFromToast = () => {
    if (!restoreDraftToast) {
      return;
    }

    setTitle(restoreDraftToast.title);
    setCategory(
      CATEGORIES.includes(restoreDraftToast.category)
        ? restoreDraftToast.category
        : "Campus News"
    );
    setTags(restoreDraftToast.tags.slice(0, 5));
    setContentHtml(restoreDraftToast.body);
    setInitialContent(restoreDraftToast.body);
    setDraftId(restoreDraftToast.draftId);
    setDraftSavedAt(restoreDraftToast.savedAt);
    setEditorRenderKey((value) => value + 1);

    if (restoreDraftToast.storageKey === LEGACY_DRAFT_BODY_KEY) {
      const migratedDraft: StoredDraft = {
        draftId: restoreDraftToast.draftId,
        title: restoreDraftToast.title,
        body: restoreDraftToast.body,
        tags: restoreDraftToast.tags,
        category: restoreDraftToast.category,
        excerpt:
          restoreDraftToast.excerpt || buildExcerptFromHtml(restoreDraftToast.body),
        savedAt: restoreDraftToast.savedAt,
      };
      localStorage.setItem(
        `${DRAFT_KEY_PREFIX}${restoreDraftToast.draftId}`,
        JSON.stringify(migratedDraft)
      );
      localStorage.removeItem(LEGACY_DRAFT_BODY_KEY);
    }

    setRestoreDraftToast(null);
  };

  const discardDraftFromToast = () => {
    if (!restoreDraftToast) {
      return;
    }

    localStorage.removeItem(restoreDraftToast.storageKey);
    setRestoreDraftToast(null);
    setDraftSavedAt("");
    setDraftId(createDraftId());
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^,/, "").replace(/,$/, "");
      if (newTag && !tags.includes(newTag) && tags.length < 5) {
        setTags([...tags, newTag]);
        setTagInput("");
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  async function parseJsonSafe<T>(response: Response): Promise<T | null> {
    const raw = await response.text();
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  const handleSubmit = async () => {
    const sanitizedBody = sanitizeArticleBody(contentHtml);

    if (!title.trim() || isEditorContentEmpty(sanitizedBody)) {
      alert("Please enter a title and content.");
      return;
    }

    setIsSubmitting(true);

    try {
      const excerpt = buildExcerptFromHtml(sanitizedBody);
      const coverImageUrl = extractFirstImageUrl(sanitizedBody);

      const payload = {
        title: title.trim(),
        body: sanitizedBody,
        excerpt,
        content_gdoc_id: null,
        cover_image_url: coverImageUrl,
        category_name: category,
        tags,
      };

      const res = await fetch(apiUrl("/api/v1/articles"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await parseJsonSafe<{ message?: string; error?: string; slug?: string }>(
        res
      );

      if (res.status === 401) {
        throw new Error("Session expired. Please refresh and sign in again.");
      }

      if (!res.ok) {
        throw new Error(
          body?.message ??
            body?.error ??
            `Failed to submit article (HTTP ${res.status})`
        );
      }

      // Clear draft locally since it's published
      localStorage.removeItem(LEGACY_DRAFT_BODY_KEY);
      if (draftId) {
        localStorage.removeItem(`${DRAFT_KEY_PREFIX}${draftId}`);
      }

      if (!body?.slug) {
        throw new Error(
          "Article created, but server response was invalid. Please refresh and check your articles."
        );
      }

      router.push(ROUTES.article.detail(body.slug));
      
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof ApiBaseUrlConfigurationError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred while submitting.";
      alert(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      {/* Meta Input Area */}
      <div className="mb-8 space-y-6">
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Your headline..."
          className="w-full text-5xl font-fraunces font-bold text-[#1a1917] bg-transparent outline-none resize-none placeholder:text-gray-300"
          rows={2}
        />

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-2 bg-[#f6f5f0] border border-[#e8e6e0] text-[#1a1917] font-medium rounded-full outline-none focus:ring-2 focus:ring-[#d4613c]/30"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 border border-[#e8e6e0] bg-white rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#d4613c]/30">
            {tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 bg-[#f6f5f0] text-sm text-[#1a1917] px-2 py-0.5 rounded-full"
              >
                {t}
                <button
                  onClick={() => removeTag(t)}
                  className="text-gray-400 hover:text-[#d4613c] transition-colors"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            {tags.length < 5 && (
              <input
                type="text"
                placeholder={tags.length === 0 ? "Add tags (comma separated)..." : "..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="bg-transparent text-sm w-48 outline-none border-none placeholder:text-gray-400 text-[#1a1917]"
              />
            )}
          </div>
        </div>

        <p className="text-xs text-[#6b6960]">
          {draftSavedAt
            ? `Draft saved ${formatDraftTime(draftSavedAt)}`
            : "Draft has not been autosaved yet"}
        </p>
      </div>

      {/* Tiptap Editor */}
      <div className="mb-8">
        <ArticleEditor
          key={`editor-${editorRenderKey}`}
          initialContent={initialContent}
          sessionToken={sessionToken}
          onChange={setContentHtml}
          autosaveEnabled={false}
        />

        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-[#e2ddd4] bg-[#f6f5f0] px-4 py-2 text-xs text-[#6b6960]">
          <span>{wordCount} words</span>
          <span>
            {characterCount} / {MAX_CHARACTERS} characters
          </span>
          <span>{readTimeMinutes} min read</span>
          <span className="ml-auto">
            {draftSavedAt
              ? `Draft saved at ${formatDraftTime(draftSavedAt)}`
              : "Draft not saved yet"}
          </span>
        </div>
      </div>

      {/* Action Area */}
      <div className="flex justify-end border-t border-[#e8e6e0] py-6 gap-4">
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim() || isEditorContentEmpty(contentHtml)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...
            </>
          ) : (
            "Publish Article"
          )}
        </Button>
      </div>

      {restoreDraftToast && (
        <div className="fixed bottom-6 right-6 z-[60] w-[min(92vw,380px)] rounded-xl border border-[#d1cfc8] bg-[#fffdf7] p-4 shadow-lg">
          <p className="text-sm font-semibold text-[#1a1917]">Restore saved draft?</p>
          <p className="mt-1 text-xs text-[#6b6960]">
            Last saved at {formatDraftTime(restoreDraftToast.savedAt)}.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={discardDraftFromToast}
              className="rounded-md border border-[#d1cfc8] px-3 py-1.5 text-xs font-medium text-[#6b6960] hover:bg-[#f1eee5]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={restoreDraftFromToast}
              className="rounded-md border border-[#d4613c] bg-[#d4613c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#bf5534]"
            >
              Restore
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
