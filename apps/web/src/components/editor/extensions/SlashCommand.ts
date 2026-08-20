import { Extension, type Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { LucideIcon } from "lucide-react";
import tippy, {
  type GetReferenceClientRect,
  type Instance as TippyInstance,
} from "tippy.js";
import { SlashCommandList, type SlashCommandListRef } from "./SlashCommandList";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Group heading shown above the first item of each category. */
  category?: string;
  aliases?: string[];
  command: (editor: Editor) => void;
}

interface SlashCommandOptions {
  items: SlashCommandItem[];
}

const slashCommandPluginKey = new PluginKey("openforum-slash-command");
const MAX_VISIBLE_ITEMS = 40;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Ranks items so exact/prefix title matches beat alias matches, which beat
 * generic substring matches anywhere in the title/description/aliases.
 */
function filterItems(
  items: SlashCommandItem[],
  query: string,
): SlashCommandItem[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return items;
  }

  return items
    .map((item) => {
      const title = item.title.toLowerCase();
      const aliases = (item.aliases ?? []).map((alias) => alias.toLowerCase());
      const haystack = [title, item.description.toLowerCase(), ...aliases].join(
        " ",
      );

      let score = 0;
      if (title.startsWith(normalizedQuery)) score = 4;
      else if (title.includes(normalizedQuery)) score = 3;
      else if (aliases.some((alias) => alias.startsWith(normalizedQuery)))
        score = 2;
      else if (haystack.includes(normalizedQuery)) score = 1;

      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/**
 * `/`-triggered command menu. Renders a React list (icons + category
 * grouping + fuzzy-ish ranked search) positioned with tippy/popper, which
 * handles viewport-edge collision far more robustly than manual DOM
 * positioning math.
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      items: [],
    };
  },

  addProseMirrorPlugins() {
    const getItems = () => this.options.items;

    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: "/",
        allowSpaces: true,
        startOfLine: false,
        items: ({ query }) =>
          filterItems(getItems(), query).slice(0, MAX_VISIBLE_ITEMS),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.command(editor);
        },
        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null;
          let popup: TippyInstance[] = [];

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandList, {
                props: {
                  items: props.items,
                  query: props.query,
                  command: props.command,
                },
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy("body", {
                getReferenceClientRect:
                  props.clientRect as GetReferenceClientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                offset: [0, 8],
                animation: false,
              });
            },

            onUpdate(props) {
              component?.updateProps({
                items: props.items,
                query: props.query,
                command: props.command,
              });

              if (!props.clientRect) {
                return;
              }

              popup[0]?.setProps({
                getReferenceClientRect:
                  props.clientRect as GetReferenceClientRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === "Escape") {
                popup[0]?.hide();
                return true;
              }

              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit() {
              popup[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
