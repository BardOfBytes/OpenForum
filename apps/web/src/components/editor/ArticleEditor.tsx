"use client";

import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { Mathematics } from "@tiptap/extension-mathematics";
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import css from "highlight.js/lib/languages/css";
import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { ApiBaseUrlConfigurationError, apiUrl } from "@/lib/api/base-url";
import {
  Image as ImageIcon,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  Strikethrough,
  Heading,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Code,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Table2,
  PlaySquare,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sigma,
  Sparkles,
} from "lucide-react";
import { CodeBlockLowlightWithLanguage } from "./extensions/CodeBlockWithLanguage";
import {
  SlashCommand,
  type SlashCommandItem,
} from "./extensions/SlashCommand";
import styles from "./ArticleEditor.module.css";
import "katex/dist/katex.min.css";

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

const lowlight = createLowlight();

lowlight.register("javascript", javascript);
lowlight.register("js", javascript);
lowlight.register("typescript", typescript);
lowlight.register("ts", typescript);
lowlight.register("python", python);
lowlight.register("py", python);
lowlight.register("rust", rust);
lowlight.register("bash", bash);
lowlight.register("shell", bash);
lowlight.register("json", json);
lowlight.register("markdown", markdown);
lowlight.register("md", markdown);
lowlight.register("css", css);

interface UploadResponse {
  error?: string;
  message?: string;
  public_url?: string;
}

type HeadingLevelOption = "paragraph" | "h1" | "h2" | "h3";

interface ToolbarState {
  currentHeadingLevel: HeadingLevelOption;
  hasSelection: boolean;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isHighlight: boolean;
  isStrike: boolean;
  isLink: boolean;
  isInlineCode: boolean;
  isYoutube: boolean;
  isCodeBlock: boolean;
  isBlockquote: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;
  isTable: boolean;
  isAlignLeft: boolean;
  isAlignCenter: boolean;
  isAlignRight: boolean;
  isInlineMath: boolean;
  isBlockMath: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  currentHeadingLevel: "paragraph",
  hasSelection: false,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isHighlight: false,
  isStrike: false,
  isLink: false,
  isInlineCode: false,
  isYoutube: false,
  isCodeBlock: false,
  isBlockquote: false,
  isBulletList: false,
  isOrderedList: false,
  isTaskList: false,
  isTable: false,
  isAlignLeft: false,
  isAlignCenter: false,
  isAlignRight: false,
  isInlineMath: false,
  isBlockMath: false,
  canUndo: false,
  canRedo: false,
};

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
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState("https://");
  const autosaveEnabledRef = useRef(autosaveEnabled);
  const onChangeRef = useRef(onChange);
  const editorRef = useRef<TiptapEditor | null>(null);
  const saveIndicatorTimeoutRef = useRef<number | null>(null);

  const showSaveIndicator = useCallback((message: string, timeoutMs = 2200) => {
    setSaveIndicator(message);

    if (saveIndicatorTimeoutRef.current) {
      window.clearTimeout(saveIndicatorTimeoutRef.current);
    }

    saveIndicatorTimeoutRef.current = window.setTimeout(() => {
      setSaveIndicator("");
      saveIndicatorTimeoutRef.current = null;
    }, timeoutMs);
  }, []);

  useEffect(() => {
    autosaveEnabledRef.current = autosaveEnabled;
  }, [autosaveEnabled]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (saveIndicatorTimeoutRef.current) {
        window.clearTimeout(saveIndicatorTimeoutRef.current);
      }
    };
  }, []);

  const toolbarButtonClass = (active = false) =>
    `p-2 rounded transition border disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? "bg-[#f5ddd3] border-[#e2bea8] text-[#8f3a21]"
        : "border-transparent text-gray-600 hover:bg-gray-200 hover:text-black"
    }`;

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("File too large. Maximum upload size is 5 MB.");
      }

      if (!file.type || !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
        throw new Error("Unsupported file type. Please upload JPG, PNG, or WEBP.");
      }

      showSaveIndicator("Uploading image...", 4000);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(apiUrl("/api/v1/upload"), {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const body = await parseJsonSafe<UploadResponse>(response);

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

      showSaveIndicator("Image uploaded");
      return body.public_url;
    },
    [sessionToken, showSaveIndicator]
  );

  const insertImageAtSelection = useCallback(
    (
      imageUrl: string,
      position?: number,
      targetEditor?: TiptapEditor | null
    ) => {
      const activeEditor = targetEditor ?? editorRef.current;

      if (!activeEditor) {
        return;
      }

      const chain = activeEditor.chain().focus();

      if (typeof position === "number") {
        const maxPosition = activeEditor.state.doc.content.size;
        const safePosition = Math.max(1, Math.min(position, maxPosition));
        chain.setTextSelection(safePosition);
      }

      chain.setImage({ src: imageUrl }).run();
    },
    []
  );

  const handleImageFiles = useCallback(
    async (
      files: FileList | File[],
      position?: number,
      targetEditor?: TiptapEditor | null
    ) => {
      const [firstFile] = Array.from(files);

      if (!firstFile) {
        return;
      }

      try {
        const uploadedImageUrl = await uploadImage(firstFile);
        insertImageAtSelection(uploadedImageUrl, position, targetEditor);
      } catch (err: unknown) {
        console.error("Image upload failed:", err);
        const message =
          err instanceof ApiBaseUrlConfigurationError
            ? err.message
            : err instanceof TypeError && err.message === "Failed to fetch"
              ? "Cannot reach upload API. Verify NEXT_PUBLIC_API_URL uses https:// and API CORS allows this frontend origin."
              : err instanceof Error
                ? err.message
                : "Image upload failed.";
        setSaveIndicator("");
        alert(message);
      }
    },
    [insertImageAtSelection, uploadImage]
  );

  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";

    input.onchange = async () => {
      if (!input.files?.length) {
        return;
      }

      const position = editorRef.current?.state.selection.from;
      await handleImageFiles(input.files, position, editorRef.current);
    };

    input.click();
  }, [handleImageFiles]);

  const insertYoutubeVideo = useCallback((targetEditor?: TiptapEditor | null) => {
    const activeEditor = targetEditor ?? editorRef.current;

    if (!activeEditor) {
      return;
    }

    const input = window.prompt(
      "Paste a YouTube URL",
      "https://www.youtube.com/watch?v="
    );

    if (input === null) {
      return;
    }

    const url = input.trim();

    if (!url) {
      return;
    }

    if (!isSafeHttpUrl(url)) {
      alert("Please enter a valid http:// or https:// YouTube URL.");
      return;
    }

    const inserted = activeEditor
      .chain()
      .focus()
      .setYoutubeVideo({
        src: url,
        width: 960,
        height: 540,
      })
      .run();

    if (!inserted) {
      alert("That does not look like a valid YouTube URL.");
    }
  }, []);

  const insertCallout = useCallback((targetEditor?: TiptapEditor | null) => {
    const activeEditor = targetEditor ?? editorRef.current;

    if (!activeEditor) {
      return;
    }

    activeEditor
      .chain()
      .focus()
      .insertContent(
        '<blockquote><p><strong>Callout:</strong> Add an important note here.</p></blockquote>'
      )
      .run();
  }, []);

  const insertInlineMathNode = useCallback((targetEditor?: TiptapEditor | null) => {
    const activeEditor = targetEditor ?? editorRef.current;

    if (!activeEditor) {
      return;
    }

    const latex = window.prompt("Inline LaTeX", "x^2")?.trim();

    if (!latex) {
      return;
    }

    const inserted = activeEditor
      .chain()
      .focus()
      .insertInlineMath({ latex })
      .run();

    if (!inserted) {
      alert("Could not insert inline equation at the current cursor position.");
    }
  }, []);

  const insertBlockMathNode = useCallback((targetEditor?: TiptapEditor | null) => {
    const activeEditor = targetEditor ?? editorRef.current;

    if (!activeEditor) {
      return;
    }

    const latex = window.prompt("Block LaTeX", "\\sum_{i=1}^{n} x_i")?.trim();

    if (!latex) {
      return;
    }

    const inserted = activeEditor
      .chain()
      .focus()
      .insertBlockMath({ latex })
      .run();

    if (!inserted) {
      alert("Could not insert block equation at the current cursor position.");
    }
  }, []);

  const slashCommands = useMemo<SlashCommandItem[]>(
    () => [
      {
        title: "Heading 1",
        description: "Large section heading",
        aliases: ["h1", "title"],
        command: (targetEditor) =>
          targetEditor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        title: "Heading 2",
        description: "Section heading",
        aliases: ["h2", "subtitle"],
        command: (targetEditor) =>
          targetEditor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        title: "Heading 3",
        description: "Subsection heading",
        aliases: ["h3"],
        command: (targetEditor) =>
          targetEditor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        title: "Bullet List",
        description: "Unordered list",
        aliases: ["ul", "list"],
        command: (targetEditor) => targetEditor.chain().focus().toggleBulletList().run(),
      },
      {
        title: "Ordered List",
        description: "Numbered list",
        aliases: ["ol", "numbered"],
        command: (targetEditor) => targetEditor.chain().focus().toggleOrderedList().run(),
      },
      {
        title: "Task List",
        description: "Checklist with toggles",
        aliases: ["todo", "checklist"],
        command: (targetEditor) => targetEditor.chain().focus().toggleTaskList().run(),
      },
      {
        title: "Code Block",
        description: "Syntax highlighted code",
        aliases: ["code", "snippet"],
        command: (targetEditor) => targetEditor.chain().focus().toggleCodeBlock().run(),
      },
      {
        title: "Blockquote",
        description: "Quoted callout block",
        aliases: ["quote"],
        command: (targetEditor) => targetEditor.chain().focus().toggleBlockquote().run(),
      },
      {
        title: "Table",
        description: "Insert a 3x3 table",
        aliases: ["grid"],
        command: (targetEditor) =>
          targetEditor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      },
      {
        title: "Image",
        description: "Upload an image",
        aliases: ["photo", "media"],
        command: () => handleImageUpload(),
      },
      {
        title: "YouTube",
        description: "Embed a YouTube video",
        aliases: ["video"],
        command: (targetEditor) => insertYoutubeVideo(targetEditor),
      },
      {
        title: "Divider",
        description: "Horizontal rule",
        aliases: ["hr", "separator"],
        command: (targetEditor) => targetEditor.chain().focus().setHorizontalRule().run(),
      },
      {
        title: "Callout",
        description: "Important highlighted note",
        aliases: ["note", "alert"],
        command: (targetEditor) => insertCallout(targetEditor),
      },
      {
        title: "Inline Math",
        description: "Insert LaTeX inline equation",
        aliases: ["math", "latex"],
        command: (targetEditor) => insertInlineMathNode(targetEditor),
      },
      {
        title: "Block Math",
        description: "Insert displayed LaTeX equation",
        aliases: ["equation"],
        command: (targetEditor) => insertBlockMathNode(targetEditor),
      },
    ],
    [
      handleImageUpload,
      insertBlockMathNode,
      insertCallout,
      insertInlineMathNode,
      insertYoutubeVideo,
    ]
  );

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
      }),
      CodeBlockLowlightWithLanguage.configure({
        lowlight,
      }),
      Image,
      Link.configure({
        openOnClick: false,
      }),
      Underline,
      Highlight.configure({
        multicolor: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({
        addPasteHandler: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Mathematics.configure({
        inlineOptions: {
          onClick: (_node, pos) => {
            const activeEditor = editorRef.current;

            if (!activeEditor) {
              return;
            }

            const currentNode = activeEditor.state.doc.nodeAt(pos);
            const currentLatex =
              typeof currentNode?.attrs?.latex === "string" ? currentNode.attrs.latex : "";
            const nextLatex = window.prompt("Edit inline LaTeX", currentLatex)?.trim();

            if (!nextLatex) {
              return;
            }

            activeEditor.chain().focus().updateInlineMath({ pos, latex: nextLatex }).run();
          },
        },
        blockOptions: {
          onClick: (_node, pos) => {
            const activeEditor = editorRef.current;

            if (!activeEditor) {
              return;
            }

            const currentNode = activeEditor.state.doc.nodeAt(pos);
            const currentLatex =
              typeof currentNode?.attrs?.latex === "string" ? currentNode.attrs.latex : "";
            const nextLatex = window.prompt("Edit block LaTeX", currentLatex)?.trim();

            if (!nextLatex) {
              return;
            }

            activeEditor.chain().focus().updateBlockMath({ pos, latex: nextLatex }).run();
          },
        },
        katexOptions: {
          throwOnError: false,
          strict: false,
        },
      }),
      Placeholder.configure({
        placeholder: "Write your masterpiece...",
      }),
      CharacterCount.configure({
        limit: MAX_CHARACTERS,
      }),
      SlashCommand.configure({
        items: slashCommands,
      }),
    ],
    content: initialContent,
    onCreate: ({ editor: activeEditor }) => {
      editorRef.current = activeEditor;
      onChangeRef.current(activeEditor.getHTML());
    },
    onUpdate: ({ editor: activeEditor }) => {
      editorRef.current = activeEditor;
      onChangeRef.current(activeEditor.getHTML());
    },
    onDestroy: () => {
      editorRef.current = null;
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-lg focus:outline-none max-w-none min-h-[500px] px-1",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) {
          return false;
        }

        const imageFiles = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith("image/")
        );

        if (!imageFiles.length) {
          return false;
        }

        event.preventDefault();

        const dropPosition = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;

        void handleImageFiles(imageFiles, dropPosition, editorRef.current);
        return true;
      },
      handlePaste: (_view, event) => {
        const imageFiles = Array.from(event.clipboardData?.files ?? []).filter((file) =>
          file.type.startsWith("image/")
        );

        if (!imageFiles.length) {
          return false;
        }

        event.preventDefault();
        const pastePosition = editorRef.current?.state.selection.from;
        void handleImageFiles(imageFiles, pastePosition, editorRef.current);
        return true;
      },
    },
  }, [initialContent, sessionToken, slashCommands, handleImageFiles]);

  // Auto-save logic
  useEffect(() => {
    if (!editor) return;

    const interval = window.setInterval(() => {
      if (!autosaveEnabledRef.current) {
        return;
      }

      const html = editor.getHTML();
      if (!isEditorContentEmpty(html)) {
        localStorage.setItem(STORAGE_KEY, html);
        showSaveIndicator("Body draft cached");
      }
    }, 30000); // 30 seconds

    return () => window.clearInterval(interval);
  }, [editor, showSaveIndicator]);

  useEffect(() => {
    if (!editor || !isLinkEditorOpen) {
      return;
    }

    const closeInlineLinkEditor = () => {
      if (editor.state.selection.empty && !editor.isActive("link")) {
        setIsLinkEditorOpen(false);
      }
    };

    editor.on("selectionUpdate", closeInlineLinkEditor);

    return () => {
      editor.off("selectionUpdate", closeInlineLinkEditor);
    };
  }, [editor, isLinkEditorOpen]);

  const toolbarState =
    useEditorState({
      editor,
      selector: ({ editor: activeEditor }): ToolbarState => {
        if (!activeEditor) {
          return DEFAULT_TOOLBAR_STATE;
        }

        const currentHeadingLevel: HeadingLevelOption = activeEditor.isActive("heading", {
          level: 1,
        })
          ? "h1"
          : activeEditor.isActive("heading", { level: 2 })
            ? "h2"
            : activeEditor.isActive("heading", { level: 3 })
              ? "h3"
              : "paragraph";

        return {
          currentHeadingLevel,
          hasSelection: !activeEditor.state.selection.empty,
          isBold: activeEditor.isActive("bold"),
          isItalic: activeEditor.isActive("italic"),
          isUnderline: activeEditor.isActive("underline"),
          isHighlight: activeEditor.isActive("highlight"),
          isStrike: activeEditor.isActive("strike"),
          isLink: activeEditor.isActive("link"),
          isInlineCode: activeEditor.isActive("code"),
          isYoutube: activeEditor.isActive("youtube"),
          isCodeBlock: activeEditor.isActive("codeBlock"),
          isBlockquote: activeEditor.isActive("blockquote"),
          isBulletList: activeEditor.isActive("bulletList"),
          isOrderedList: activeEditor.isActive("orderedList"),
          isTaskList: activeEditor.isActive("taskList"),
          isTable: activeEditor.isActive("table"),
          isAlignLeft: activeEditor.isActive({ textAlign: "left" }),
          isAlignCenter: activeEditor.isActive({ textAlign: "center" }),
          isAlignRight: activeEditor.isActive({ textAlign: "right" }),
          isInlineMath: activeEditor.isActive("inlineMath"),
          isBlockMath: activeEditor.isActive("blockMath"),
          canUndo: activeEditor.can().undo(),
          canRedo: activeEditor.can().redo(),
        };
      },
    }) ?? DEFAULT_TOOLBAR_STATE;

  const openLinkEditor = useCallback(() => {
    const activeEditor = editorRef.current;

    if (!activeEditor) {
      return;
    }

    if (activeEditor.state.selection.empty) {
      alert("Select text first, then add a link.");
      return;
    }

    const existingUrl =
      (activeEditor.getAttributes("link").href as string | undefined) ?? "https://";
    setLinkInputValue(existingUrl);
    setIsLinkEditorOpen(true);
  }, []);

  const applyLinkFromBubble = useCallback(() => {
    const activeEditor = editorRef.current;

    if (!activeEditor) {
      return;
    }

    const url = linkInputValue.trim();

    if (!url) {
      activeEditor.chain().focus().unsetLink().run();
      setIsLinkEditorOpen(false);
      return;
    }

    if (!isSafeHttpUrl(url)) {
      alert("Please enter a valid http:// or https:// URL.");
      return;
    }

    activeEditor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();

    setIsLinkEditorOpen(false);
  }, [linkInputValue]);

  const bubbleMenuOptions = useMemo(
    () => ({
      strategy: "fixed" as const,
      placement: "top" as const,
      offset: {
        mainAxis: 10,
        crossAxis: 0,
      },
    }),
    []
  );

  const shouldShowBubbleMenu = useCallback(
    ({ editor: activeEditor, from, to }: { editor: TiptapEditor; from: number; to: number }) =>
      isLinkEditorOpen || (!activeEditor.state.selection.empty && from !== to),
    [isLinkEditorOpen]
  );

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  const bubbleButtonClass = (active = false) =>
    `px-2.5 py-1.5 rounded-md text-sm font-medium border transition ${
      active
        ? "bg-[#f5ddd3] border-[#e2bea8] text-[#8f3a21]"
        : "bg-transparent border-transparent text-[#3f3e3a] hover:bg-[#ece9de]"
    }`;

  const isInTable = toolbarState.isTable;

  return (
    <div
      className={`w-full border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm ${styles.editorSurface}`}
    >
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-1 rounded-xl border border-[#d1cfc8] bg-[#fffdf7] p-1.5 shadow-lg"
        options={bubbleMenuOptions}
        shouldShow={shouldShowBubbleMenu}
      >
        {isLinkEditorOpen ? (
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={linkInputValue}
              onChange={(event) => setLinkInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLinkFromBubble();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsLinkEditorOpen(false);
                }
              }}
              placeholder="https://example.com"
              className="w-64 rounded-md border border-[#d1cfc8] bg-white px-2 py-1 text-sm outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={applyLinkFromBubble}
              className={bubbleButtonClass(false)}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setIsLinkEditorOpen(false);
              }}
              className={bubbleButtonClass(false)}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={bubbleButtonClass(toolbarState.isBold)}
              title="Bold"
            >
              <Bold size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={bubbleButtonClass(toolbarState.isItalic)}
              title="Italic"
            >
              <Italic size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={bubbleButtonClass(toolbarState.isUnderline)}
              title="Underline"
            >
              <UnderlineIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              className={bubbleButtonClass(toolbarState.isHighlight)}
              title="Highlight"
            >
              <Highlighter size={16} />
            </button>
            <button
              type="button"
              onClick={openLinkEditor}
              className={bubbleButtonClass(toolbarState.isLink)}
              title="Link"
            >
              <LinkIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={bubbleButtonClass(toolbarState.isInlineCode)}
              title="Inline Code"
            >
              <Code size={16} />
            </button>
            <button
              type="button"
              onClick={() => alert("Ask AI is coming soon.")}
              className={bubbleButtonClass(false)}
              title="Ask AI"
            >
              <Sparkles size={16} />
            </button>
          </>
        )}
      </BubbleMenu>

      {/* Top Fixed Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100 bg-[#f6f5f0]">
        <div className="relative">
          <Heading size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6960]" />
          <select
            value={toolbarState.currentHeadingLevel}
            onChange={(event) => {
              const value = event.target.value;

              if (value === "paragraph") {
                editor.chain().focus().setParagraph().run();
                return;
              }

              const level = Number(value.slice(1)) as 1 | 2 | 3;
              editor.chain().focus().toggleHeading({ level }).run();
            }}
            className="h-9 rounded border border-[#d1cfc8] bg-white pl-8 pr-3 text-sm text-[#1a1917] outline-none"
            title="Heading level"
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={toolbarButtonClass(toolbarState.isBold)}
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={toolbarButtonClass(toolbarState.isItalic)}
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={toolbarButtonClass(toolbarState.isUnderline)}
          title="Underline"
        >
          <UnderlineIcon size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={toolbarButtonClass(toolbarState.isHighlight)}
          title="Highlight"
        >
          <Highlighter size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={toolbarButtonClass(toolbarState.isStrike)}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </button>

        <button
          type="button"
          onClick={openLinkEditor}
          className={toolbarButtonClass(toolbarState.isLink)}
          title="Link"
          disabled={!toolbarState.hasSelection}
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
          onClick={() => insertYoutubeVideo(editor)}
          className={toolbarButtonClass(toolbarState.isYoutube)}
          title="Embed YouTube"
        >
          <PlaySquare size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={toolbarButtonClass(toolbarState.isCodeBlock)}
          title="Code Block"
        >
          <Code size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={toolbarButtonClass(toolbarState.isBlockquote)}
          title="Blockquote"
        >
          <Quote size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={toolbarButtonClass(false)}
          title="Divider"
        >
          <Minus size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarButtonClass(toolbarState.isBulletList)}
          title="Bullet List"
        >
          <List size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarButtonClass(toolbarState.isOrderedList)}
          title="Ordered List"
        >
          <ListOrdered size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={toolbarButtonClass(toolbarState.isTaskList)}
          title="Task List"
        >
          <CheckSquare size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className={toolbarButtonClass(toolbarState.isTable)}
          title="Insert Table"
        >
          <Table2 size={18} />
        </button>

        {isInTable && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className={toolbarButtonClass(false)}
              title="Add Row"
            >
              +R
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className={toolbarButtonClass(false)}
              title="Delete Row"
            >
              -R
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className={toolbarButtonClass(false)}
              title="Add Column"
            >
              +C
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className={toolbarButtonClass(false)}
              title="Delete Column"
            >
              -C
            </button>
          </>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={toolbarButtonClass(toolbarState.isAlignLeft)}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={toolbarButtonClass(toolbarState.isAlignCenter)}
          title="Align Center"
        >
          <AlignCenter size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={toolbarButtonClass(toolbarState.isAlignRight)}
          title="Align Right"
        >
          <AlignRight size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => insertInlineMathNode(editor)}
          className={toolbarButtonClass(toolbarState.isInlineMath)}
          title="Inline Math"
        >
          <Sigma size={18} />
        </button>
        <button
          type="button"
          onClick={() => insertBlockMathNode(editor)}
          className={toolbarButtonClass(toolbarState.isBlockMath)}
          title="Block Math"
        >
          $$
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className={toolbarButtonClass()}
          title="Undo"
          disabled={!toolbarState.canUndo}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className={toolbarButtonClass()}
          title="Redo"
          disabled={!toolbarState.canRedo}
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

      <div className="bg-[#f6f5f0] border-t border-gray-100 px-3 py-2 text-xs text-[#6b6960]">
        Type / for commands. Drag, drop, or paste images directly into the editor.
      </div>
    </div>
  );
}
