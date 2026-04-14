"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect, useState, useCallback } from "react";
import {
  Image as ImageIcon,
  Code,
  Quote,
  List,
  ListOrdered,
} from "lucide-react";

interface ArticleEditorProps {
  initialContent?: string;
  sessionToken: string;
  onChange: (html: string) => void;
}

const STORAGE_KEY = "draft_article_body";
const MAX_CHARACTERS = 10000;

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
}: ArticleEditorProps) {
  const [saveIndicator, setSaveIndicator] = useState("");

  const editor = useEditor({
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
      const html = editor.getHTML();
      if (html && html !== "<p></p>") {
        localStorage.setItem(STORAGE_KEY, html);
        setSaveIndicator("Draft saved locally");
        setTimeout(() => setSaveIndicator(""), 3000);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [editor, sessionToken]);

  // Image Upload handler
  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      if (input.files?.length) {
        const file = input.files[0];

        try {
          setSaveIndicator("Uploading image...");
          const formData = new FormData();
          formData.append("file", file);
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

          const response = await fetch(`${apiUrl}/api/v1/upload`, {
            method: "POST",
            body: formData,
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          const body = await parseJsonSafe<{ error?: string; message?: string; public_url?: string }>(
            response
          );

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
          onClick={handleImageUpload}
          className="p-2 text-gray-600 hover:bg-gray-200 hover:text-black rounded transition"
          title="Upload Image"
        >
          <ImageIcon size={18} />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded transition ${
            editor.isActive("codeBlock") ? "bg-gray-200 text-black" : "text-gray-600 hover:bg-gray-200"
          }`}
          title="Code Block"
        >
          <Code size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded transition ${
            editor.isActive("blockquote") ? "bg-gray-200 text-black" : "text-gray-600 hover:bg-gray-200"
          }`}
          title="Blockquote"
        >
          <Quote size={18} />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded transition ${
            editor.isActive("bulletList") ? "bg-gray-200 text-black" : "text-gray-600 hover:bg-gray-200"
          }`}
          title="Bullet List"
        >
          <List size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded transition ${
            editor.isActive("orderedList") ? "bg-gray-200 text-black" : "text-gray-600 hover:bg-gray-200"
          }`}
          title="Ordered List"
        >
          <ListOrdered size={18} />
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
