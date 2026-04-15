/**
 * Navbar — OpenForum Layout Component
 *
 * A refined editorial navigation bar inspired by Anthropic.com that:
 * 1. Is **transparent** when on the hero section (top of page)
 * 2. Transitions to a **frosted glass** bar after scrolling past a threshold
 * 3. Shows a **hamburger menu** on mobile with full-screen overlay
 * 4. Displays **user avatar + logout** when authenticated
 * 5. Shows **sign-in button** when not authenticated
 *
 * Uses Framer Motion for the mobile menu open/close animation
 * and the scroll-triggered background transition.
 *
 * @example
 * ```tsx
 * <Navbar />
 * ```
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/routes";
import type { User } from "@supabase/supabase-js";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────────────── */

/** Scroll threshold (px) after which the navbar becomes frosted. */
const SCROLL_THRESHOLD = 32;

/** Main navigation links. */
const NAV_LINKS = [
  { label: "Articles", href: ROUTES.articles },
  { label: "Categories", href: ROUTES.categories },
  { label: "About", href: ROUTES.about },
] as const;

/** Full-width brand text width (px) before it collapses into the pipe mark. */
const BRAND_TEXT_EXPANDED_WIDTH = 170;
/** Full-width of expanded brand block (pipe + text) for collapse animation. */
const BRAND_EXPANDED_WIDTH = 196;
/** Dimensions of collapsed logo icon shown after scroll. */
const BRAND_COLLAPSED_LOGO_WIDTH = 44;
const BRAND_COLLAPSED_LOGO_HEIGHT = 32;

/* ─────────────────────────────────────────────────────────────
   HOOKS
   ───────────────────────────────────────────────────────────── */

/**
 * Tracks whether the page has scrolled past a threshold.
 * Uses requestAnimationFrame for performance.
 */
function useScrolled(threshold = SCROLL_THRESHOLD): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    }

    // Check initial scroll position
    setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

/**
 * Fetches the current Supabase user on mount.
 * Returns null if not authenticated or if env vars are missing.
 */
function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setUser(data.user);
      } catch {
        // Supabase env vars not set — expected during build/dev
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();
    return () => { cancelled = true; };
  }, []);

  return { user, loading };
}

/* ─────────────────────────────────────────────────────────────
   MOTION VARIANTS
   ───────────────────────────────────────────────────────────── */

/** Cubic-bezier easing for smooth editorial transitions. */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const mobileMenuVariants = {
  closed: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: EASE_OUT_EXPO },
  },
  open: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE_OUT_EXPO },
  },
};

const menuItemVariants = {
  closed: { opacity: 0, x: -12 },
  open: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.3,
      ease: EASE_OUT_EXPO,
    },
  }),
};

/* ─────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────── */

export function Navbar() {
  const scrolled = useScrolled();
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading: userLoading } = useUser();

  /** Close mobile menu on route change. */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /** Lock body scroll when mobile menu is open. */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  /** Sign out the current user. */
  const handleSignOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = ROUTES.home;
    } catch (err) {
      console.error("[navbar] Sign out failed:", err);
    }
  }, []);

  /** Check if a nav link is currently active. */
  function isActive(href: string): boolean {
    if (href === ROUTES.articles) {
      return pathname === ROUTES.articles || pathname.startsWith(`${ROUTES.articles}/`);
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      <motion.header
        role="banner"
        className={[
          "fixed top-0 left-0 right-0 z-sticky",
          "transition-all duration-slow ease-out-expo",
          scrolled
            ? "glass border-b border-border-light shadow-xs"
            : "bg-transparent",
        ].join(" ")}
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      >
        <nav
          className="container-editorial flex items-center justify-between h-16"
          aria-label="Main navigation"
        >
          {/* ── Logo ──────────────────────────────────────── */}
          <Link
            href={ROUTES.home}
            className="flex items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md pr-1"
            aria-label="OpenForum home"
          >
            {/*
              Scroll-reactive brand animation:
              - At top: pipe + "OpenForum"
              - On scroll: expanded brand collapses and full icon logo appears
            */}
            <motion.span
              className="flex items-center overflow-hidden"
              initial={false}
              animate={
                reduceMotion
                  ? {
                      maxWidth: scrolled ? 0 : BRAND_EXPANDED_WIDTH,
                      opacity: scrolled ? 0 : 1,
                    }
                  : {
                      maxWidth: scrolled ? 0 : BRAND_EXPANDED_WIDTH,
                      opacity: scrolled ? 0 : 1,
                    }
              }
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
              aria-hidden={scrolled}
            >
              <div
                className="w-2 h-6 rounded-full bg-accent transition-transform duration-normal group-hover:scale-y-110"
                aria-hidden="true"
              />

              <motion.span
                className="block overflow-hidden"
                initial={false}
                animate={
                  reduceMotion
                    ? { maxWidth: BRAND_TEXT_EXPANDED_WIDTH, marginLeft: 8, opacity: 1 }
                    : {
                        maxWidth: scrolled ? 0 : BRAND_TEXT_EXPANDED_WIDTH,
                        marginLeft: scrolled ? 0 : 8,
                        opacity: scrolled ? 0 : 1,
                      }
                }
                transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                aria-hidden="true"
              >
                <motion.span
                  className="block whitespace-nowrap font-heading font-semibold text-lg tracking-tight text-text"
                  initial={false}
                  animate={
                    reduceMotion
                      ? { x: 0 }
                      : {
                          x: scrolled ? -28 : 0,
                        }
                  }
                  transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                >
                  OpenForum
                </motion.span>
              </motion.span>
            </motion.span>

            <motion.span
              className="block overflow-hidden"
              initial={false}
              animate={
                reduceMotion
                  ? {
                      maxWidth: scrolled ? BRAND_COLLAPSED_LOGO_WIDTH : 0,
                      opacity: scrolled ? 1 : 0,
                    }
                  : {
                      maxWidth: scrolled ? BRAND_COLLAPSED_LOGO_WIDTH : 0,
                      opacity: scrolled ? 1 : 0,
                    }
              }
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
              aria-hidden={!scrolled}
            >
              <motion.span
                className="block"
                initial={false}
                animate={
                  reduceMotion
                    ? { x: 0 }
                    : {
                        x: scrolled ? 0 : -10,
                      }
                }
                transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
              >
                <Image
                  src="/icon.png"
                  alt="OpenForum"
                  width={BRAND_COLLAPSED_LOGO_WIDTH}
                  height={BRAND_COLLAPSED_LOGO_HEIGHT}
                  className="h-8 w-auto max-w-none"
                  priority
                />
              </motion.span>
            </motion.span>
          </Link>

          {/* ── Desktop Links ─────────────────────────────── */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "relative px-3 py-2 rounded-lg text-sm font-medium font-body",
                  "transition-colors duration-fast",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  isActive(link.href)
                    ? "text-text bg-surface"
                    : "text-text-secondary hover:text-text hover:bg-surface/60",
                ].join(" ")}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── Right Section ─────────────────────────────── */}
          <div className="flex items-center gap-3">
            {/* Auth state */}
            {!userLoading && (
              <>
                {user ? (
                  /* Authenticated: avatar + dropdown */
                  <div className="hidden md:flex items-center gap-3">
                    <Link
                      href={ROUTES.write}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium font-body bg-accent text-text-inverse hover:bg-accent-hover transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Write
                    </Link>

                    {/* User avatar */}
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={`Sign out (${user.email})`}
                      title={`Signed in as ${user.email}\nClick to sign out`}
                    >
                      {user.user_metadata?.avatar_url ? (
                        <Image
                          src={user.user_metadata.avatar_url}
                          alt=""
                          width={28}
                          height={28}
                          className="rounded-full ring-2 ring-border-light"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent"
                          aria-hidden="true"
                        >
                          {(user.email ?? "U")[0].toUpperCase()}
                        </div>
                      )}
                      {/* Logout icon */}
                      <svg
                        className="w-4 h-4 text-text-tertiary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  /* Not authenticated: sign-in link */
                  <Link
                    href={ROUTES.login}
                    className="hidden md:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium font-body border border-border text-text hover:bg-surface hover:border-text-tertiary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    Sign in
                  </Link>
                )}
              </>
            )}

            {/* ── Hamburger (mobile) ──────────────────────── */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-surface transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              <div className="relative w-5 h-4 flex flex-col justify-between">
                <motion.span
                  className="block h-0.5 w-full bg-text rounded-full origin-left"
                  animate={
                    mobileOpen
                      ? { rotate: 45, y: 0, width: "100%" }
                      : { rotate: 0, y: 0, width: "100%" }
                  }
                  transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                />
                <motion.span
                  className="block h-0.5 w-full bg-text rounded-full"
                  animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
                  transition={{ duration: 0.15 }}
                />
                <motion.span
                  className="block h-0.5 w-full bg-text rounded-full origin-left"
                  animate={
                    mobileOpen
                      ? { rotate: -45, y: 0, width: "100%" }
                      : { rotate: 0, y: 0, width: "100%" }
                  }
                  transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                />
              </div>
            </button>
          </div>
        </nav>
      </motion.header>

      {/* ── Mobile Menu Overlay ────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            variants={mobileMenuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-0 z-overlay md:hidden"
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-bg/95 backdrop-blur-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Menu content */}
            <div className="relative z-10 flex flex-col px-6 pt-24 pb-8 h-full">
              <div className="flex flex-col gap-2">
                {NAV_LINKS.map((link, i) => (
                  <motion.div
                    key={link.href}
                    custom={i}
                    variants={menuItemVariants}
                    initial="closed"
                    animate="open"
                  >
                    <Link
                      href={link.href}
                      className={[
                        "block px-4 py-3 rounded-xl text-lg font-heading font-semibold",
                        "transition-colors duration-fast",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        isActive(link.href)
                          ? "text-text bg-surface"
                          : "text-text-secondary hover:text-text hover:bg-surface/60",
                      ].join(" ")}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive(link.href) ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Mobile auth actions */}
              <div className="mt-auto pt-8 border-t border-border-light">
                {user ? (
                  <div className="space-y-3">
                    {/* User info */}
                    <div className="flex items-center gap-3 px-4 py-2">
                      {user.user_metadata?.avatar_url ? (
                        <Image
                          src={user.user_metadata.avatar_url}
                          alt=""
                          width={36}
                          height={36}
                          className="rounded-full ring-2 ring-border-light"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-medium text-accent">
                          {(user.email ?? "U")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">
                          {user.user_metadata?.full_name ?? user.email}
                        </p>
                        <p className="text-xs text-text-tertiary truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={ROUTES.write}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-text-inverse font-medium text-sm hover:bg-accent-hover transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Write Article
                    </Link>

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-text-secondary text-sm font-medium hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href={ROUTES.login}
                    className="flex items-center justify-center px-4 py-3 rounded-xl bg-accent text-text-inverse font-medium text-sm hover:bg-accent-hover transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign in with CSVTU
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer — pushes content below the fixed navbar */}
      <div className="h-16" aria-hidden="true" />
    </>
  );
}
