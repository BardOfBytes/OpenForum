"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect, useState, useCallback, useRef } from "react";
import { ApiBaseUrlConfigurationError, apiUrl } from "@/lib/api/base-url";
import {
  Image as ImageIcon,
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Code,
  Quote,
  List,
  ListOrdered,
} from "lucide-react";

interface ArticleEditorProps {
  initialContent?: string;
  sessionToken: string;
  onChange: (html: string) => void;
  autosaveEnabled?: boolean;
}

const STORAGE_KEY = "draft_article_body";
const MAX_CHARACTERS = 10000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isEditorContentEmpty(html: string): boolean {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const plainText = (temp.textContent || "").replace(/\u00a0/g, " ").trim();
  return plainText.length === 0 && !temp.querySelector("img");
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function ArticleEditor({
  initialContent = "",
  sessionToken,
  onChange,
  autosaveEnabled = true,
}: ArticleEditorProps) {
  const [saveIndicator, setSaveIndicator] = useState("");
  const autosaveEnabledRef = useRef(autosaveEnabled);

  useEffect(() => {
    autosaveEnabledRef.current = autosaveEnabled;
  }, [autosaveEnabled]);

  const toolbarButtonClass = (active = false) =>
    `p-2 rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? "bg-gray-200 text-black"
        : "text-gray-600 hover:bg-gray-200 hover:text-black"
    }`;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Write your masterpiece...",
      }),
      CharacterCount.configure({
        limit: MAX_CHARACTERS,
      }),
    ],
    content: initialContent,
    onCreate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-lg focus:outline-none max-w-none min-h-[500px]",
      },
    },
  });

  // Auto-save logic
  useEffect(() => {
    if (!editor) return;

    const interval = setInterval(() => {
      if (!autosaveEnabledRef.current) {
        return;
      }

      const html = editor.getHTML();
      if (!isEditorContentEmpty(html)) {
        localStorage.setItem(STORAGE_KEY, html);
        setSaveIndicator("Draft saved locally");
        setTimeout(() => setSaveIndicator(""), 3000);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [editor]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = (editor.getAttributes("link").href as string | undefined) ?? "https://";
    const input = window.prompt(
      "Enter URL (leave empty to remove link)",
      previousUrl
    );

    if (input === null) {
      return;
    }

    const url = input.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    if (!isSafeHttpUrl(url)) {
      alert("Please enter a valid http:// or https:// URL.");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  // Image Upload handler
  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      if (input.files?.length) {
        const file = input.files[0];

        try {
          if (file.size > MAX_IMAGE_SIZE_BYTES) {
            throw new Error("File too large. Maximum upload size is 5 MB.");
          }
          if (file.type && !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
            throw new Error("Unsupported file type. Please upload JPG, PNG, or WEBP.");
          }

          setSaveIndicator("Uploading image...");
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(apiUrl("/api/v1/upload"), {
            method: "POST",
            body: formData,
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          const body = await parseJsonSafe<{ error?: string; message?: string; public_url?: string }>(
            response
          );

          if (response.status === 401) {
            throw new Error("Session expired. Please refresh and sign in again.");
          }

          if (!response.ok) {
            throw new Error(
              body?.message ??
                body?.error ??
                `Image upload failed (HTTP ${response.status}).`
            );
          }

          if (!body?.public_url) {
            throw new Error("Upload succeeded but no image URL was returned.");
          }

          if (!isSafeHttpUrl(body.public_url)) {
            throw new Error("Upload returned an invalid image URL.");
          }

          if (editor) {
            editor
              .chain()
              .focus()
              .setImage({ src: body.public_url })
              .run();
          }
          setSaveIndicator("Image uploaded");
          setTimeout(() => setSaveIndicator(""), 2000);
        } catch (err: unknown) {
          console.error("Image upload failed:", err);
          const message =
            err instanceof ApiBaseUrlConfigurationError
              ? err.message
              :
            err instanceof TypeError && err.message === "Failed to fetch"
              ? "Cannot reach upload API. Verify NEXT_PUBLIC_API_URL uses https:// and API CORS allows this frontend origin."
              : err instanceof Error
                ? err.message
                : "Image upload failed.";
          setSaveIndicator("");
          alert(message);
        }
      }
    };

    input.click();
  }, [editor, sessionToken]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="w-full border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Top Fixed Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100 bg-[#f6f5f0]">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={toolbarButtonClass(editor.isActive("bold"))}
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={toolbarButtonClass(editor.isActive("italic"))}
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={toolbarButtonClass(editor.isActive("strike"))}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={toolbarButtonClass(editor.isActive("heading", { level: 1 }))}
          title="Heading 1"
        >
          <Heading1 size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={toolbarButtonClass(editor.isActive("heading", { level: 2 }))}
          title="Heading 2"
        >
          <Heading2 size={18} />
        </button>
        <button
          type="button"
          onClick={handleSetLink}
          className={toolbarButtonClass(editor.isActive("link"))}
          title="Link"
        >
          <LinkIcon size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={handleImageUpload}
          className={toolbarButtonClass()}
          title="Upload Image"
        >
          <ImageIcon size={18} />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={toolbarButtonClass(editor.isActive("codeBlock"))}
          title="Code Block"
        >
          <Code size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={toolbarButtonClass(editor.isActive("blockquote"))}
          title="Blockquote"
        >
          <Quote size={18} />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarButtonClass(editor.isActive("bulletList"))}
          title="Bullet List"
        >
          <List size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarButtonClass(editor.isActive("orderedList"))}
          title="Ordered List"
        >
          <ListOrdered size={18} />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className={toolbarButtonClass()}
          title="Undo"
          disabled={!editor.can().chain().focus().undo().run()}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className={toolbarButtonClass()}
          title="Redo"
          disabled={!editor.can().chain().focus().redo().run()}
        >
          <Redo2 size={18} />
        </button>
        
        <div className="ml-auto text-xs text-gray-500 font-medium px-2">
          {saveIndicator}
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="p-4 sm:p-6 lg:p-8 min-h-[500px]">
        <EditorContent editor={editor} />
      </div>

      {/* Character Count Footer */}
      <div className="bg-[#f6f5f0] border-t border-gray-100 p-2 text-right text-xs text-gray-500">
        {editor.storage.characterCount.characters()} / {MAX_CHARACTERS} characters
      </div>
    </div>
  );
}
