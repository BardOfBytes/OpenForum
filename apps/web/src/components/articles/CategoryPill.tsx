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
        "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
