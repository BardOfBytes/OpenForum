import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface FindMatch {
  from: number;
  to: number;
}

export interface FindAndReplaceStorage {
  searchTerm: string;
  results: FindMatch[];
  activeIndex: number;
}

declare module "@tiptap/core" {
  interface Storage {
    findAndReplace: FindAndReplaceStorage;
  }

  interface Commands<ReturnType> {
    findAndReplace: {
      /** Sets the search term, recomputes matches, and jumps to the first one. */
      setSearchTerm: (searchTerm: string) => ReturnType;
      /** Moves the active match to the next result, wrapping around. */
      goToNextMatch: () => ReturnType;
      /** Moves the active match to the previous result, wrapping around. */
      goToPreviousMatch: () => ReturnType;
      /** Replaces only the currently active match. */
      replaceActiveMatch: (replaceTerm: string) => ReturnType;
      /** Replaces every match in the document. */
      replaceAllMatches: (replaceTerm: string) => ReturnType;
      /** Clears the search term, matches, and highlight decorations. */
      clearSearch: () => ReturnType;
    };
  }
}

const findAndReplacePluginKey = new PluginKey<DecorationSet>(
  "openforum-find-replace",
);

function findMatches(doc: ProseMirrorNode, searchTerm: string): FindMatch[] {
  const results: FindMatch[] = [];
  const normalizedTerm = searchTerm.trim().toLowerCase();

  if (!normalizedTerm) {
    return results;
  }

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    const text = node.text.toLowerCase();
    let searchIndex = 0;

    while (searchIndex !== -1) {
      searchIndex = text.indexOf(normalizedTerm, searchIndex);

      if (searchIndex === -1) {
        break;
      }

      results.push({
        from: pos + searchIndex,
        to: pos + searchIndex + normalizedTerm.length,
      });
      searchIndex += normalizedTerm.length;
    }
  });

  return results;
}

function buildDecorations(
  doc: ProseMirrorNode,
  results: FindMatch[],
  activeIndex: number,
): DecorationSet {
  if (!results.length) {
    return DecorationSet.empty;
  }

  const decorations = results.map((result, index) =>
    Decoration.inline(result.from, result.to, {
      class:
        index === activeIndex
          ? "openforum-find-match openforum-find-match-active"
          : "openforum-find-match",
    }),
  );

  return DecorationSet.create(doc, decorations);
}

function focusMatch(
  tr: Transaction,
  doc: ProseMirrorNode,
  match: FindMatch | undefined,
): Transaction {
  if (!match) {
    return tr.setMeta(findAndReplacePluginKey, true);
  }

  const selection = TextSelection.create(doc, match.from, match.to);
  return tr
    .setSelection(selection)
    .setMeta(findAndReplacePluginKey, true)
    .scrollIntoView();
}

/**
 * In-editor find & replace. Keeps its match list + active index in
 * `editor.storage.findAndReplace` (read reactively via `useEditorState`) and
 * renders highlight decorations for every match via a ProseMirror plugin.
 */
export const FindAndReplace = Extension.create<
  Record<string, never>,
  FindAndReplaceStorage
>({
  name: "findAndReplace",

  addStorage() {
    return {
      searchTerm: "",
      results: [],
      activeIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ tr, dispatch }) => {
          this.storage.searchTerm = searchTerm;
          this.storage.results = findMatches(tr.doc, searchTerm);
          this.storage.activeIndex = 0;

          if (dispatch) {
            dispatch(focusMatch(tr, tr.doc, this.storage.results[0]));
          }

          return true;
        },

      goToNextMatch:
        () =>
        ({ tr, dispatch }) => {
          if (!this.storage.results.length) {
            return false;
          }

          this.storage.activeIndex =
            (this.storage.activeIndex + 1) % this.storage.results.length;

          if (dispatch) {
            dispatch(
              focusMatch(
                tr,
                tr.doc,
                this.storage.results[this.storage.activeIndex],
              ),
            );
          }

          return true;
        },

      goToPreviousMatch:
        () =>
        ({ tr, dispatch }) => {
          if (!this.storage.results.length) {
            return false;
          }

          this.storage.activeIndex =
            (this.storage.activeIndex - 1 + this.storage.results.length) %
            this.storage.results.length;

          if (dispatch) {
            dispatch(
              focusMatch(
                tr,
                tr.doc,
                this.storage.results[this.storage.activeIndex],
              ),
            );
          }

          return true;
        },

      replaceActiveMatch:
        (replaceTerm: string) =>
        ({ tr, dispatch }) => {
          const match = this.storage.results[this.storage.activeIndex];

          if (!match) {
            return false;
          }

          if (dispatch) {
            tr.insertText(replaceTerm, match.from, match.to);
            dispatch(tr);
          }

          return true;
        },

      replaceAllMatches:
        (replaceTerm: string) =>
        ({ tr, dispatch }) => {
          if (!this.storage.results.length) {
            return false;
          }

          if (dispatch) {
            [...this.storage.results]
              .sort((a, b) => b.from - a.from)
              .forEach((match) => {
                tr.insertText(replaceTerm, match.from, match.to);
              });
            dispatch(tr);
          }

          return true;
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          this.storage.searchTerm = "";
          this.storage.results = [];
          this.storage.activeIndex = 0;

          if (dispatch) {
            dispatch(tr.setMeta(findAndReplacePluginKey, true));
          }

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: findAndReplacePluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            if (tr.docChanged) {
              storage.results = findMatches(tr.doc, storage.searchTerm);
              storage.activeIndex = Math.min(
                storage.activeIndex,
                Math.max(0, storage.results.length - 1),
              );
            }

            if (!tr.docChanged && !tr.getMeta(findAndReplacePluginKey)) {
              return old;
            }

            return buildDecorations(
              tr.doc,
              storage.results,
              storage.activeIndex,
            );
          },
        },
        props: {
          decorations(state) {
            return findAndReplacePluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
