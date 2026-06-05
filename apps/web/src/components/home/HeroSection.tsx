/**
 * Hero Section — OpenForum Homepage
 *
 * Full-viewport editorial hero with:
 * - Staggered text reveal animation (word-by-word via Framer Motion)
 * - Coral underline accent on "Story"
 * - CTA buttons "Start Reading" + "Write for Us"
 * - Subtle background grain + warm gradient
 *
 * Uses `"use client"` because Framer Motion animations require
 * client-side hydration.
 */

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, PenSquare } from "lucide-react";
import { ROUTES } from "@/lib/routes";

/** Cubic-bezier easing for smooth editorial transitions. */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Animation orchestration for the hero container. */
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

/** Animation for each word/element in the stagger sequence. */
const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: EASE },
  },
};

/** The coral underline animation — draws from left to right. */
const underlineVariants = {
  hidden: { scaleX: 0, originX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 0.8, delay: 0.9, ease: EASE },
  },
};

export function HeroSection() {
  return (
    <section
      className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden"
      aria-label="Hero"
    >
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 35%, rgba(212,97,60,0.09) 0%, transparent 72%)",
        }}
      />

      <div
        className="absolute right-[10%] top-20 -z-10 hidden h-48 w-48 rounded-full border-2 border-accent opacity-[0.04] md:block"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-1/4 left-[8%] top-1/4 -z-10 hidden w-px bg-border lg:block"
        aria-hidden="true"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container-editorial max-w-5xl px-6 py-16 text-center md:py-24"
      >
        <motion.div
          variants={itemVariants}
          className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.28em] text-accent"
        >
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          Latest Issue
        </motion.div>

        <h1 className="mb-6 font-heading text-5xl font-semibold leading-[1.05] tracking-tight text-text text-balance md:text-7xl lg:text-[6rem]">
          <motion.span variants={itemVariants} className="inline">
            Ideas that shape our{" "}
          </motion.span>
          <motion.span
            variants={itemVariants}
            className="relative inline-block font-normal italic text-accent"
          >
            tomorrow.
            <motion.span
              variants={underlineVariants}
              className="absolute bottom-1 left-0 right-0 -z-10 h-3 rounded-full bg-accent/15 md:bottom-2"
              aria-hidden="true"
            />
          </motion.span>
        </h1>

        <motion.p
          variants={itemVariants}
          className="mx-auto mb-10 max-w-2xl font-body text-lg leading-relaxed text-text-secondary md:text-xl"
        >
          A student-run editorial publication by the scholars, creators, and thinkers of CSVTU.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href={ROUTES.articles}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-text-inverse shadow-sm transition-colors hover:bg-accent-hover"
          >
            Read the latest
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={ROUTES.write}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-6 py-3 text-sm font-semibold text-text transition-colors hover:bg-surface"
          >
            <PenSquare className="h-4 w-4" />
            Start writing
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
