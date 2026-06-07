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
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PenSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ROUTES } from "@/lib/routes";
import type { User } from "@supabase/supabase-js";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────────────── */

/** Scroll threshold (px) after which the navbar becomes frosted. */
const SCROLL_THRESHOLD = 32;

/** Main navigation links. */
const NAV_LINKS = [
  { label: "Home", href: ROUTES.home },
  { label: "Articles", href: ROUTES.articles },
  { label: "Categories", href: ROUTES.categories },
  { label: "About", href: ROUTES.about },
] as const;

interface NavbarProps {
  brandText?: string;
}

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

export function Navbar({
  brandText = "OpenForum",
}: NavbarProps = {}) {
  const scrolled = useScrolled();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading: userLoading } = useUser();

  const brandPrefix = brandText === "OpenForum" ? "Open" : brandText;
  const brandSuffix = brandText === "OpenForum" ? "Forum" : "";

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
    if (href === ROUTES.home) {
      return pathname === ROUTES.home;
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      <motion.header
        role="banner"
        className={[
          "fixed top-0 left-0 right-0",
          mobileOpen ? "z-overlay" : "z-sticky",
          "transition-all duration-300 ease-out-expo",
          scrolled
            ? "glass border-b border-border-light py-3 shadow-sm"
            : "bg-transparent py-5",
        ].join(" ")}
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      >
        <nav
          className="container mx-auto flex max-w-6xl items-center justify-between px-4 md:px-8"
          aria-label="Main navigation"
        >
          {/* ── Logo ──────────────────────────────────────── */}
          <Link
            href={ROUTES.home}
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="OpenForum home"
          >
            <span className="font-serif text-2xl font-bold tracking-tight text-foreground">
              {brandPrefix}
              {brandSuffix ? (
                <span className="font-light italic text-primary">{brandSuffix}</span>
              ) : null}
            </span>
          </Link>

          {/* ── Desktop Links ─────────────────────────────── */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "text-sm font-medium transition-colors duration-fast hover:text-primary",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive(link.href)
                    ? "text-primary"
                    : "text-muted-foreground",
                ].join(" ")}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── Right Section ─────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ThemeToggle compact />
            </div>

            {/* Auth state */}
            {!userLoading && (
              <>
                {user ? (
                  /* Authenticated: avatar + dropdown */
                  <div className="hidden items-center gap-3 md:flex">
                    <Link
                      href={ROUTES.write}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors duration-fast hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <PenSquare className="h-4 w-4" />
                      Write
                    </Link>

                    <div className="mx-1 h-4 w-px bg-border" />

                    <Link
                      href={ROUTES.profile}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`View profile (${user.email})`}
                      title={`Signed in as ${user.email}`}
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
                    </Link>

                    <button
                      onClick={handleSignOut}
                      className="rounded-lg px-2 py-2 text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Sign out (${user.email})`}
                      title="Sign out"
                    >
                      <svg
                        className="w-4 h-4"
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
                    className="hidden items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
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
            <div className="relative z-10 flex flex-col px-6 pt-6 pb-8 h-full">
              {/* Close button */}
              <div className="flex items-center justify-between mb-8">
                <Link
                  href={ROUTES.home}
                  className="font-serif text-2xl font-bold tracking-tight text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  Open<span className="font-light italic text-primary">Forum</span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
                <div className="mb-4">
                  <ThemeToggle />
                </div>

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
                      href={ROUTES.profile}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-text transition-colors hover:bg-surface"
                      onClick={() => setMobileOpen(false)}
                    >
                      View Profile
                    </Link>

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
