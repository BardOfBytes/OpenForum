/**
 * Button Component — OpenForum Design System
 *
 * Three variants following the Anthropic editorial aesthetic:
 * - **Primary**: Terracotta coral fill — for main CTAs
 * - **Secondary**: Outlined with warm border — for secondary actions
 * - **Ghost**: No border/fill — for inline actions, nav links
 *
 * Uses Framer Motion for subtle hover lift + scale micro-animation
 * that gives the editorial design a tactile, paper-pressing feel.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg">Publish Article</Button>
 * <Button variant="secondary" icon={<PenIcon />}>Edit</Button>
 * <Button variant="ghost" size="sm">Cancel</Button>
 * ```
 */

"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

/* ─────────────────────────────────────────────────────────────
   VARIANT STYLES
   ───────────────────────────────────────────────────────────── */

const VARIANTS = {
  primary: [
    "bg-accent text-text-inverse",
    "hover:bg-accent-hover",
    "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "active:scale-[0.98]",
    "shadow-sm hover:shadow-md",
  ].join(" "),

  secondary: [
    "bg-transparent text-text",
    "border border-border hover:border-text-tertiary",
    "hover:bg-surface",
    "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "active:scale-[0.98]",
  ].join(" "),

  ghost: [
    "bg-transparent text-text-secondary",
    "hover:text-text hover:bg-surface",
    "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "active:scale-[0.98]",
  ].join(" "),
} as const;

const SIZES = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-md",
  md: "px-4 py-2.5 text-sm gap-2 rounded-lg",
  lg: "px-6 py-3 text-base gap-2.5 rounded-lg",
} as const;

/* ─────────────────────────────────────────────────────────────
   FRAMER MOTION ANIMATION PRESETS
   ───────────────────────────────────────────────────────────── */

/** Subtle lift + scale on hover — like pressing paper. */
const MOTION_HOVER = {
  y: -1,
  scale: 1.015,
  transition: {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
};

const MOTION_TAP = {
  y: 0,
  scale: 0.98,
  transition: { duration: 0.1 },
};

/* ─────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────── */

type ButtonVariant = keyof typeof VARIANTS;
type ButtonSize = keyof typeof SIZES;

interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof HTMLMotionProps<"button">> {
  /** Visual variant. Default: `"primary"`. */
  variant?: ButtonVariant;
  /** Size preset. Default: `"md"`. */
  size?: ButtonSize;
  /** Icon element rendered before the label. */
  icon?: ReactNode;
  /** Icon element rendered after the label. */
  iconRight?: ReactNode;
  /** Show a loading spinner and disable interaction. */
  loading?: boolean;
  /** Full width button. */
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * Accessible button with Framer Motion hover animation.
 *
 * Renders as `motion.button` for smooth lift + scale transitions.
 * Supports icon placement, loading state, and full-width mode.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      icon,
      iconRight,
      loading = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileHover={isDisabled ? undefined : MOTION_HOVER}
        whileTap={isDisabled ? undefined : MOTION_TAP}
        disabled={isDisabled}
        className={[
          // Base styles
          "inline-flex items-center justify-center",
          "font-body font-medium",
          "transition-colors duration-normal ease-out-expo",
          "select-none cursor-pointer",
          // Variant & size
          VARIANTS[variant],
          SIZES[size],
          // States
          fullWidth ? "w-full" : "",
          isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <svg
            className="h-4 w-4 animate-spin shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Leading icon */}
        {!loading && icon && (
          <span className="shrink-0 flex items-center" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Label */}
        <span>{children}</span>

        {/* Trailing icon */}
        {iconRight && (
          <span className="shrink-0 flex items-center" aria-hidden="true">
            {iconRight}
          </span>
        )}
      </motion.button>
    );
  }
);
