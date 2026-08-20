import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SlashCommandItem } from "./SlashCommand";

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  query: string;
  command: (item: SlashCommandItem) => void;
}

function highlightMatch(text: string, query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return text;
  }

  const index = text.toLowerCase().indexOf(trimmedQuery.toLowerCase());

  if (index === -1) {
    return text;
  }

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-accent/25 text-inherit">
        {text.slice(index, index + trimmedQuery.length)}
      </mark>
      {text.slice(index + trimmedQuery.length)}
    </>
  );
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  function SlashCommandList({ items, query, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (!items.length) {
          return event.key === "Escape";
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="w-72 rounded-xl border border-border bg-bg-elevated p-3 text-sm text-text-secondary shadow-lg">
          No matching commands
        </div>
      );
    }

    let lastCategory = "";

    return (
      <div className="max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-1.5 shadow-lg">
        {items.map((item, index) => {
          const showCategoryHeader = Boolean(item.category) && item.category !== lastCategory;
          lastCategory = item.category ?? lastCategory;
          const isSelected = index === selectedIndex;

          return (
            <div key={item.title}>
              {showCategoryHeader && (
                <div className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary/70 first:pt-1.5">
                  {item.category}
                </div>
              )}
              <button
                type="button"
                onMouseEnter={() => setSelectedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectItem(index);
                }}
                className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                  isSelected
                    ? "border-accent/30 bg-accent-light"
                    : "border-transparent hover:bg-surface"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                    isSelected ? "border-accent/30 text-accent" : "border-border text-text-secondary"
                  } bg-bg`}
                >
                  <item.icon size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-text">
                    {highlightMatch(item.title, query)}
                  </span>
                  <span className="block truncate text-xs text-text-secondary">
                    {item.description}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    );
  }
);
