"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import ArticleEditor from "@/components/editor/ArticleEditor";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/routes";

const CATEGORIES = [
  "Campus News",
  "Tech & AI",
  "Editorials",
  "Internship Diaries",
  "Career Paths",
  "Investigations",
];

export default function WriteForm({ sessionToken }: { sessionToken: string }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [category, setCategory] = useState("Campus News");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialContent, setInitialContent] = useState("");

  useEffect(() => {
    const draft = localStorage.getItem("draft_article_body");
    if (draft) {
      setInitialContent(draft);
    }
  }, []);

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
    if (!title.trim() || !contentHtml || contentHtml === "<p></p>") {
      alert("Please enter a title and content.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Excerpt generation constraint (e.g. text from HTML)
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = contentHtml;
      const textContent = tempDiv.textContent || tempDiv.innerText || "";
      const excerpt = textContent.slice(0, 150) + (textContent.length > 150 ? "..." : "");

      const payload = {
        title: title.trim(),
        body: contentHtml,
        excerpt,
        content_gdoc_id: null,
        cover_image_url: null, // You could parse the body here for the first image
        category_name: category,
        tags,
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiUrl}/api/v1/articles`, {
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

      if (!res.ok) {
        throw new Error(
          body?.message ??
            body?.error ??
            `Failed to submit article (HTTP ${res.status})`
        );
      }

      // Clear draft locally since it's published
      localStorage.removeItem("draft_article_body");

      if (!body?.slug) {
        throw new Error(
          "Article created, but server response was invalid. Please refresh and check your articles."
        );
      }

      router.push(ROUTES.article.detail(body.slug));
      
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "An error occurred while submitting.";
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
      </div>

      {/* Tiptap Editor */}
      <div className="mb-8">
        <ArticleEditor
          initialContent={initialContent}
          sessionToken={sessionToken}
          onChange={setContentHtml}
        />
      </div>

      {/* Action Area */}
      <div className="flex justify-end border-t border-[#e8e6e0] py-6 gap-4">
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !title || !contentHtml}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...
            </>
          ) : (
            "Publish Article"
          )}
        </Button>
      </div>
    </div>
  );
}
