"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface CategoryPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function CategoryPill({
  active = false,
  children,
  className = "",
  ...props
}: CategoryPillProps) {
  return (
    <button
      type="button"
      className={[
        "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "border border-accent bg-accent text-text-inverse shadow-sm"
          : "border border-border bg-transparent text-text-secondary hover:bg-surface hover:text-text",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
