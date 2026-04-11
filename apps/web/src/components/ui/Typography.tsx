/**
 * Typography Components — OpenForum Design System
 *
 * Consistent typographic primitives built on the design token system.
 * Fraunces (serif) for headings, DM Sans (sans) for body text.
 *
 * Components:
 * - `Heading`  — Serif headings (h1–h6) with editorial presence
 * - `Body`     — Sans-serif body text with size/weight variants
 * - `Caption`  — Small muted text for metadata, timestamps
 * - `Label`    — Uppercase tracked labels for categories, badges
 *
 * All components accept a polymorphic `as` prop for semantic HTML.
 *
 * @example
 * ```tsx
 * <Heading level={1}>The State of Campus Life</Heading>
 * <Body size="lg" weight="medium">Lead paragraph text</Body>
 * <Caption>Published 3 days ago · 5 min read</Caption>
 * <Label color="accent">Opinion</Label>
 * ```
 */

import { type ReactNode, type ElementType, type HTMLAttributes } from "react";

/* ─────────────────────────────────────────────────────────────
   HEADING
   ───────────────────────────────────────────────────────────── */

/** Size-to-class mapping for headings. */
const HEADING_STYLES: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-4xl md:text-5xl font-semibold tracking-tight leading-none",
  2: "text-3xl md:text-4xl font-semibold tracking-tight leading-tight",
  3: "text-2xl md:text-3xl font-semibold tracking-tight leading-tight",
  4: "text-xl md:text-2xl font-semibold leading-snug",
  5: "text-lg md:text-xl font-semibold leading-snug",
  6: "text-base md:text-lg font-semibold leading-snug",
};

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Heading level (1–6). Determines both the HTML tag and visual size. */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Override the rendered HTML element (e.g., render h1 styles as h2 tag). */
  as?: ElementType;
  /** Optional accent-colored display. */
  accent?: boolean;
  children: ReactNode;
}

/**
 * Editorial heading using Fraunces serif typeface.
 *
 * @param level - Heading level (1–6), defaults to 2.
 * @param as - Override HTML element tag.
 * @param accent - Apply terracotta accent color.
 */
export function Heading({
  level = 2,
  as,
  accent = false,
  className = "",
  children,
  ...props
}: HeadingProps) {
  const Tag = as ?? (`h${level}` as ElementType);
  const sizeClass = HEADING_STYLES[level];
  const accentClass = accent ? "text-gradient-accent" : "text-text";

  return (
    <Tag
      className={`font-heading ${sizeClass} ${accentClass} text-balance ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────────────────────────────────────
   BODY
   ───────────────────────────────────────────────────────────── */

const BODY_SIZES = {
  sm: "text-sm",
  base: "text-base",
  md: "text-md",
  lg: "text-lg",
} as const;

const BODY_WEIGHTS = {
  normal: "font-normal",
  medium: "font-medium",
  bold: "font-bold",
} as const;

const BODY_COLORS = {
  default: "text-text",
  secondary: "text-text-secondary",
  tertiary: "text-text-tertiary",
  accent: "text-accent",
  inverse: "text-text-inverse",
} as const;

interface BodyProps extends HTMLAttributes<HTMLElement> {
  /** Text size. Default: `"base"`. */
  size?: keyof typeof BODY_SIZES;
  /** Font weight. Default: `"normal"`. */
  weight?: keyof typeof BODY_WEIGHTS;
  /** Text color preset. Default: `"default"`. */
  color?: keyof typeof BODY_COLORS;
  /** Override the rendered HTML element. Default: `<p>`. */
  as?: ElementType;
  children: ReactNode;
}

/**
 * Body text using DM Sans typeface.
 *
 * @param size - One of "sm", "base", "md", "lg".
 * @param weight - One of "normal", "medium", "bold".
 * @param color - Semantic color preset.
 */
export function Body({
  size = "base",
  weight = "normal",
  color = "default",
  as: Tag = "p",
  className = "",
  children,
  ...props
}: BodyProps) {
  return (
    <Tag
      className={`font-body leading-relaxed ${BODY_SIZES[size]} ${BODY_WEIGHTS[weight]} ${BODY_COLORS[color]} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────────────────────────────────────
   CAPTION
   ───────────────────────────────────────────────────────────── */

interface CaptionProps extends HTMLAttributes<HTMLElement> {
  /** Override the rendered HTML element. Default: `<span>`. */
  as?: ElementType;
  children: ReactNode;
}

/**
 * Small muted text for metadata, timestamps, and secondary information.
 */
export function Caption({
  as: Tag = "span",
  className = "",
  children,
  ...props
}: CaptionProps) {
  return (
    <Tag
      className={`font-body text-sm text-text-secondary leading-normal ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────────────────────────────────────
   LABEL
   ───────────────────────────────────────────────────────────── */

const LABEL_COLORS = {
  default: "text-text-secondary",
  accent: "text-accent",
  inverse: "text-text-inverse",
} as const;

interface LabelProps extends HTMLAttributes<HTMLElement> {
  /** Color variant. Default: `"default"`. */
  color?: keyof typeof LABEL_COLORS;
  /** Override the rendered HTML element. Default: `<span>`. */
  as?: ElementType;
  children: ReactNode;
}

/**
 * Uppercase tracked label for categories, sections, and badges.
 * Uses DM Sans with wide letter-spacing for a refined editorial feel.
 */
export function Label({
  color = "default",
  as: Tag = "span",
  className = "",
  children,
  ...props
}: LabelProps) {
  return (
    <Tag
      className={`font-body text-xs font-medium uppercase tracking-widest ${LABEL_COLORS[color]} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
