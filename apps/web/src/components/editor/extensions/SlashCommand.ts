import { Extension, type Editor } from "@tiptap/core";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";

export interface SlashCommandItem {
  title: string;
  description: string;
  aliases?: string[];
  command: (editor: Editor) => void;
}

interface SlashCommandOptions {
  items: SlashCommandItem[];
}

const slashCommandPluginKey = new PluginKey("openforum-slash-command");

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function filterItems(items: SlashCommandItem[], query: string): SlashCommandItem[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => {
    const haystack = [item.title, item.description, ...(item.aliases ?? [])]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function getMenuShellStyles(): Partial<CSSStyleDeclaration> {
  return {
    position: "fixed",
    zIndex: "55",
    minWidth: "260px",
    maxWidth: "360px",
    maxHeight: "320px",
    overflowY: "auto",
    background: "#fffdf7",
    border: "1px solid #d1cfc8",
    borderRadius: "12px",
    boxShadow: "0 16px 30px rgba(26, 25, 23, 0.12)",
    padding: "8px",
  };
}

function getMenuItemStyles(selected: boolean): Partial<CSSStyleDeclaration> {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    borderRadius: "10px",
    border: "1px solid transparent",
    background: selected ? "#f5ddd3" : "transparent",
    color: "#1a1917",
    padding: "8px 10px",
    cursor: "pointer",
    transition: "background 120ms ease, border-color 120ms ease",
  };
}

function applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, styles);
}

function createSlashRenderer() {
  let menuElement: HTMLDivElement | null = null;
  let listElement: HTMLDivElement | null = null;
  let selectedIndex = 0;
  let latestProps: SuggestionProps<SlashCommandItem, SlashCommandItem> | null = null;

  const cleanup = () => {
    if (menuElement && menuElement.parentNode) {
      menuElement.parentNode.removeChild(menuElement);
    }
    menuElement = null;
    listElement = null;
    latestProps = null;
    selectedIndex = 0;
  };

  const executeSelectedItem = (index: number): boolean => {
    if (!latestProps || !latestProps.items.length) {
      return false;
    }

    const safeIndex = Math.max(0, Math.min(index, latestProps.items.length - 1));
    const selectedItem = latestProps.items[safeIndex];

    latestProps.command(selectedItem);
    cleanup();
    return true;
  };

  const updateMenuPosition = () => {
    if (!menuElement || !latestProps?.clientRect) {
      return;
    }

    const rect = latestProps.clientRect();
    if (!rect) {
      return;
    }

    const margin = 8;
    const menuWidth = menuElement.offsetWidth || 320;
    const menuHeight = menuElement.offsetHeight || 240;

    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - menuWidth - margin)
    );

    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - menuHeight - 8;
    const top =
      belowTop + menuHeight <= window.innerHeight - margin
        ? belowTop
        : Math.max(margin, aboveTop);

    menuElement.style.left = `${left}px`;
    menuElement.style.top = `${top}px`;
  };

  const renderList = () => {
    if (!listElement || !latestProps) {
      return;
    }

    const list = listElement;
    let selectedButton: HTMLButtonElement | null = null;

    const items = latestProps.items;
    list.innerHTML = "";

    if (!items.length) {
      const emptyState = document.createElement("div");
      emptyState.textContent = "No matching commands";
      applyStyles(emptyState, {
        color: "#6b6960",
        fontSize: "13px",
        padding: "8px 10px",
      });
      list.appendChild(emptyState);
      return;
    }

    selectedIndex = Math.max(0, Math.min(selectedIndex, items.length - 1));

    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      applyStyles(button, getMenuItemStyles(index === selectedIndex));

      if (index === selectedIndex) {
        selectedButton = button;
      }

      const title = document.createElement("div");
      title.textContent = item.title;
      applyStyles(title, {
        fontSize: "13px",
        fontWeight: "600",
      });

      const description = document.createElement("div");
      description.textContent = item.description;
      applyStyles(description, {
        fontSize: "12px",
        marginTop: "2px",
        color: "#6b6960",
      });

      button.appendChild(title);
      button.appendChild(description);

      button.onmouseenter = () => {
        selectedIndex = index;
        renderList();
      };

      button.onmousedown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        void executeSelectedItem(index);
      };

      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        void executeSelectedItem(index);
      };

      list.appendChild(button);
    });

    window.requestAnimationFrame(() => {
      selectedButton?.scrollIntoView({ block: "nearest" });
      updateMenuPosition();
    });
  };

  return {
    onStart: (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
      cleanup();

      latestProps = props;
      selectedIndex = 0;

      menuElement = document.createElement("div");
      applyStyles(menuElement, getMenuShellStyles());

      listElement = document.createElement("div");
      menuElement.appendChild(listElement);

      document.body.appendChild(menuElement);

      renderList();
      updateMenuPosition();
    },

    onUpdate: (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
      latestProps = props;
      selectedIndex = 0;
      renderList();
      updateMenuPosition();
    },

    onKeyDown: ({ event }: SuggestionKeyDownProps): boolean => {
      if (!latestProps) {
        return false;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!latestProps.items.length) {
          return true;
        }
        selectedIndex = (selectedIndex + 1) % latestProps.items.length;
        renderList();
        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!latestProps.items.length) {
          return true;
        }
        selectedIndex =
          (selectedIndex - 1 + latestProps.items.length) % latestProps.items.length;
        renderList();
        return true;
      }

      if (event.key === "Enter") {
        if (!latestProps.items.length) {
          return false;
        }
        event.preventDefault();
        return executeSelectedItem(selectedIndex);
      }

      if (event.key === "Tab") {
        if (!latestProps.items.length) {
          return false;
        }
        event.preventDefault();
        return executeSelectedItem(selectedIndex);
      }

      if (event.key === "Escape") {
        event.preventDefault();
        cleanup();
        return true;
      }

      return false;
    },

    onExit: cleanup,
  };
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      items: [],
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: "/",
        allowSpaces: true,
        startOfLine: false,
        items: ({ query }) => filterItems(this.options.items, query).slice(0, 14),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .run();
          props.command(editor);
        },
        render: createSlashRenderer,
      }),
    ];
  },
});
