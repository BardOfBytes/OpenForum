/**
 * Markdown <-> HTML conversion helpers for the article editor.
 *
 * The editor stores article bodies as sanitized HTML (see `ArticleEditor` +
 * `WriteForm.sanitizeArticleBody`), but writers commonly paste content copied
 * from Markdown sources (READMEs, notes apps, ChatGPT, etc.) and expect it to
 * come in formatted rather than as literal `#`/`**`/`- ` characters. These
 * helpers convert Markdown -> HTML on paste, and HTML -> Markdown for the
 * "Export as Markdown" action.
 */

import { marked } from "marked";
import TurndownService from "turndown";

marked.setOptions({ gfm: true, breaks: false });

// ── Markdown detection ─────────────────────────────────────────────

const MARKDOWN_SIGNALS: RegExp[] = [
  /^#{1,6}\s+\S/, // ATX heading
  /^[-*+]\s+\S/, // bullet list
  /^\d+\.\s+\S/, // ordered list
  /^>\s?\S/, // blockquote
  /^```/, // fenced code block
  /^\|.+\|\s*$/, // table row
  /^(-{3,}|\*{3,}|_{3,})\s*$/, // horizontal rule
  /\[[^\]]+\]\([^)]+\)/, // link or image
  /\*\*[^*\n]+\*\*/, // bold
  /(^|\s)_[^_\n]+_(?=\s|$)/, // italic (underscore)
  /`[^`\n]+`/, // inline code
];

// Signals strong enough on their own to treat pasted text as Markdown
// (fenced code blocks and tables essentially never appear in plain prose).
const STRONG_SIGNAL_INDEXES = [4, 5];

/**
 * Heuristic check for whether a block of plain text is likely Markdown
 * source rather than ordinary prose. Used to decide whether a paste with no
 * `text/html` payload should be parsed as Markdown.
 */
export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed || trimmed.length < 3) {
    return false;
  }

  const lines = trimmed.split(/\r?\n/);
  const matchedSignals = new Set<number>();

  for (const line of lines) {
    MARKDOWN_SIGNALS.forEach((pattern, index) => {
      if (pattern.test(line)) {
        matchedSignals.add(index);
      }
    });
  }

  if (STRONG_SIGNAL_INDEXES.some((index) => matchedSignals.has(index))) {
    return true;
  }

  return matchedSignals.size >= 2;
}

// ── Markdown -> HTML (paste) ───────────────────────────────────────

/**
 * Upgrades marked's raw GFM task-list output (`<li><input type="checkbox">`)
 * into the `data-type="taskItem"` / `data-type="taskList"` shape that
 * Tiptap's TaskItem/TaskList extensions expect when parsing pasted HTML.
 */
function upgradeTaskListsHtml(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll("li").forEach((item) => {
    const checkbox = item.querySelector(':scope > input[type="checkbox"]');

    if (!checkbox) {
      return;
    }

    const checked = checkbox.hasAttribute("checked");
    checkbox.remove();
    item.setAttribute("data-type", "taskItem");
    item.setAttribute("data-checked", String(checked));

    const parentList = item.parentElement;
    if (
      parentList &&
      (parentList.tagName === "UL" || parentList.tagName === "OL")
    ) {
      parentList.setAttribute("data-type", "taskList");
    }
  });

  return container.innerHTML;
}

/** Converts Markdown source text into sanitized-schema-ready HTML. */
export function markdownToHtml(markdownText: string): string {
  const html = marked.parse(markdownText, { async: false }) as string;
  return upgradeTaskListsHtml(html);
}

// ── HTML -> Markdown (export) ──────────────────────────────────────

let cachedTurndownService: TurndownService | null = null;

function tableCellText(cell: HTMLTableCellElement): string {
  return (cell.textContent || "")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function convertTableToMarkdown(table: HTMLTableElement): string {
  const rows = Array.from(table.rows);

  if (!rows.length) {
    return "";
  }

  const headerCells = Array.from(rows[0].cells).map((cell) =>
    tableCellText(cell),
  );
  const bodyRows = rows
    .slice(1)
    .map((row) => Array.from(row.cells).map((cell) => tableCellText(cell)));

  const headerLine = `| ${headerCells.join(" | ")} |`;
  const dividerLine = `| ${headerCells.map(() => "---").join(" | ")} |`;
  const bodyLines = bodyRows.map((cells) => `| ${cells.join(" | ")} |`);

  return ["", headerLine, dividerLine, ...bodyLines, ""].join("\n");
}

function getTurndownService(): TurndownService {
  if (cachedTurndownService) {
    return cachedTurndownService;
  }

  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
  });

  // No standard Markdown syntax for these — keep as raw inline HTML, which
  // is valid in every common Markdown flavor (GFM, CommonMark, etc.).
  service.keep(["u", "sub", "sup"]);

  service.addRule("strikethrough", {
    filter: (node) => ["S", "DEL", "STRIKE"].includes(node.nodeName),
    replacement: (content) => `~~${content}~~`,
  });

  service.addRule("highlight", {
    filter: "mark",
    replacement: (content) => `==${content}==`,
  });

  service.addRule("taskListItemCheckbox", {
    filter: (node) =>
      node.nodeName === "INPUT" &&
      (node as HTMLInputElement).type === "checkbox",
    replacement: (_content, node) =>
      (node as HTMLInputElement).checked ? "[x] " : "[ ] ",
  });

  service.addRule("iframeEmbed", {
    filter: "iframe",
    replacement: (_content, node) =>
      `\n\n${(node as HTMLElement).outerHTML}\n\n`,
  });

  service.addRule("math", {
    filter: (node) =>
      node.nodeType === 1 && (node as HTMLElement).hasAttribute("data-latex"),
    replacement: (_content, node) => {
      const element = node as HTMLElement;
      const latex = element.getAttribute("data-latex") ?? "";
      const typeAttr = (element.getAttribute("data-type") ?? "").toLowerCase();
      const isBlock = element.tagName === "DIV" || typeAttr.includes("block");
      return isBlock ? `\n\n$$\n${latex}\n$$\n\n` : `$${latex}$`;
    },
  });

  service.addRule("table", {
    filter: "table",
    replacement: (_content, node) =>
      convertTableToMarkdown(node as HTMLTableElement),
  });

  cachedTurndownService = service;
  return service;
}

/** Converts sanitized article-body HTML into Markdown source text. */
export function htmlToMarkdown(html: string): string {
  return getTurndownService().turndown(html).trim();
}
