/**
 * OpenForum — Tailwind CSS Configuration
 *
 * Extends the default Tailwind config with our design system tokens.
 * CSS variables defined in globals.css are referenced here so that
 * Tailwind utilities (e.g., `bg-bg`, `text-accent`) map directly
 * to our editorial design tokens.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* ── Color Palette ─────────────────────────────────── */
      colors: {
        bg: {
          DEFAULT: "var(--color-bg)",
          elevated: "var(--color-bg-elevated)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          hover: "var(--color-surface-hover)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          light: "var(--color-border-light)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          inverse: "var(--color-text-inverse)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          light: "var(--color-accent-light)",
          subtle: "var(--color-accent-subtle)",
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
      },

      /* ── Typography ────────────────────────────────────── */
      fontFamily: {
        body: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        heading: ["var(--font-fraunces)", "Fraunces", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "var(--leading-normal)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--leading-normal)" }],
        base: ["var(--text-base)", { lineHeight: "var(--leading-normal)" }],
        md: ["var(--text-md)", { lineHeight: "var(--leading-normal)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--leading-snug)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--leading-snug)" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-tight)" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
        "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-none)" }],
        "5xl": ["var(--text-5xl)", { lineHeight: "var(--leading-none)" }],
      },

      /* ── Spacing (extends default) ─────────────────────── */
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem",
        30: "7.5rem",
      },

      /* ── Max widths ────────────────────────────────────── */
      maxWidth: {
        editorial: "var(--max-width)",
        narrow: "var(--max-width-narrow)",
        wide: "var(--max-width-wide)",
      },

      /* ── Border Radius ─────────────────────────────────── */
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },

      /* ── Shadows ───────────────────────────────────────── */
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },

      /* ── Transitions ───────────────────────────────────── */
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
      },
      transitionTimingFunction: {
        "ease-out-expo": "var(--ease-out)",
        "ease-in-out-expo": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },

      /* ── Z-index ───────────────────────────────────────── */
      zIndex: {
        dropdown: "10",
        sticky: "20",
        overlay: "30",
        modal: "40",
        toast: "50",
      },

      /* ── Animations ────────────────────────────────────── */
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s var(--ease-out) forwards",
        "fade-in": "fade-in 0.3s var(--ease-out) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
