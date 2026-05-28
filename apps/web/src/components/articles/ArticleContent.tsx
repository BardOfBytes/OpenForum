"use client";

import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";

let didRegisterHighlightLanguages = false;

function registerHighlightLanguages() {
  if (didRegisterHighlightLanguages) {
    return;
  }

  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("rust", rust);
  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("markdown", markdown);
  hljs.registerLanguage("css", css);
  hljs.registerLanguage("xml", xml);

  didRegisterHighlightLanguages = true;
}

interface ArticleContentProps {
  html: string;
}

function humanizeLanguage(language: string | null): string {
  if (!language) {
    return "Text";
  }

  const normalized = language.trim().toLowerCase();
  if (!normalized) {
    return "Text";
  }

  const aliases: Record<string, string> = {
    js: "JavaScript",
    jsx: "JSX",
    ts: "TypeScript",
    tsx: "TSX",
    py: "Python",
    rb: "Ruby",
    sh: "Shell",
    bash: "Bash",
    zsh: "Zsh",
    yml: "YAML",
    md: "Markdown",
    rs: "Rust",
    cs: "C#",
    cpp: "C++",
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function extractLanguage(codeElement: HTMLElement): string {
  const languageClass = findLanguageClass(codeElement);

  if (!languageClass) {
    return "Text";
  }

  return humanizeLanguage(languageClass.replace(/^language-/, ""));
}

function normalizeLanguageForHighlight(language: string | null): string | null {
  if (!language) {
    return null;
  }

  const normalized = language.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const aliases: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    zsh: "bash",
    yml: "yaml",
    md: "markdown",
    rs: "rust",
    html: "xml",
    svg: "xml",
  };

  const candidate = aliases[normalized] ?? normalized;
  return hljs.getLanguage(candidate) ? candidate : null;
}

function findLanguageClass(element: HTMLElement | null): string | null {
  if (!element) {
    return null;
  }

  const languageClass = Array.from(element.classList).find((className) =>
    className.startsWith("language-")
  );

  return languageClass ?? null;
}

function extractLanguageHint(codeElement: HTMLElement, preElement: HTMLElement): string | null {
  const classFromCode = findLanguageClass(codeElement)?.replace(/^language-/, "");
  if (classFromCode) {
    return classFromCode;
  }

  const classFromPre = findLanguageClass(preElement)?.replace(/^language-/, "");
  if (classFromPre) {
    return classFromPre;
  }

  const hintedLanguage =
    codeElement.getAttribute("data-language") ||
    preElement.getAttribute("data-language") ||
    codeElement.getAttribute("language") ||
    preElement.getAttribute("language");

  if (!hintedLanguage) {
    return null;
  }

  const trimmedHint = hintedLanguage.trim();
  return trimmedHint.length > 0 ? trimmedHint : null;
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (!value) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback below for older browsers or blocked permissions.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function ArticleContent({ html }: ArticleContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerHighlightLanguages();

    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.querySelectorAll(".article-code-toolbar").forEach((toolbar) => {
      toolbar.remove();
    });

    container.querySelectorAll("pre > code").forEach((codeNode) => {
      if (!(codeNode instanceof HTMLElement)) {
        return;
      }

      const pre = codeNode.parentElement;
      if (!(pre instanceof HTMLElement)) {
        return;
      }

      pre.classList.add("article-code-block");

      const rawSource = codeNode.textContent ?? "";
      const languageHint = extractLanguageHint(codeNode, pre);
      const normalizedLanguage = normalizeLanguageForHighlight(languageHint);

      let language = languageHint ? humanizeLanguage(languageHint) : extractLanguage(codeNode);

      if (normalizedLanguage) {
        codeNode.classList.add(`language-${normalizedLanguage}`);
        codeNode.removeAttribute("data-highlighted");
        hljs.highlightElement(codeNode);
        language = humanizeLanguage(normalizedLanguage);
      } else if (rawSource.trim()) {
        const result = hljs.highlightAuto(rawSource);
        codeNode.innerHTML = result.value;
        codeNode.classList.add("hljs");

        if (result.language) {
          codeNode.classList.add(`language-${result.language}`);
          language = humanizeLanguage(result.language);
        }
      }

      const toolbar = document.createElement("div");
      toolbar.className = "article-code-toolbar";

      const languageLabel = document.createElement("span");
      languageLabel.className = "article-code-language";
      languageLabel.textContent = language;

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "article-code-copy";
      copyButton.textContent = "Copy";
      copyButton.setAttribute("aria-label", `Copy ${language} code`);

      copyButton.addEventListener("click", async () => {
        const copied = await copyToClipboard(codeNode.innerText ?? codeNode.textContent ?? "");
        const originalLabel = copyButton.textContent;

        copyButton.textContent = copied ? "Copied" : "Failed";
        copyButton.disabled = true;

        window.setTimeout(() => {
          copyButton.textContent = originalLabel;
          copyButton.disabled = false;
        }, 1400);
      });

      toolbar.appendChild(languageLabel);
      toolbar.appendChild(copyButton);
      pre.insertBefore(toolbar, codeNode);
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="article-content prose prose-lg max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
