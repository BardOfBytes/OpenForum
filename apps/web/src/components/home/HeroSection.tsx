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
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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
  const router = useRouter();
  const headlineWords = ["Every", "Student", "Has", "a"];

  return (
    <section
      className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden"
      aria-label="Hero"
    >
      {/* Background gradient — warm editorial wash */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(212,97,60,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Decorative geometric accent — top right */}
      <div
        className="absolute top-20 right-[10%] w-48 h-48 rounded-full opacity-[0.04] border-2 border-accent -z-10 hidden md:block"
        aria-hidden="true"
      />

      {/* Decorative line — left side */}
      <div
        className="absolute left-[8%] top-1/4 bottom-1/4 w-px bg-border hidden lg:block"
        aria-hidden="true"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container-editorial text-center max-w-4xl px-6 py-20 md:py-32"
      >
        {/* Headline — word-by-word reveal */}
        <h1 className="font-heading font-semibold text-text tracking-tight leading-none text-balance mb-6">
          {headlineWords.map((word, i) => (
            <motion.span
              key={i}
              variants={itemVariants}
              className="inline-block mr-[0.25em] text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {word}
            </motion.span>
          ))}
          {/* "Story" with coral underline accent */}
          <motion.span
            variants={itemVariants}
            className="inline-block relative text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Story
            <motion.span
              variants={underlineVariants}
              className="absolute bottom-1 md:bottom-2 left-0 right-0 h-2 md:h-3 bg-accent/20 rounded-full -z-10"
              aria-hidden="true"
            />
          </motion.span>
        </h1>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="font-body text-text-secondary text-md md:text-lg leading-relaxed max-w-xl mx-auto mb-10"
        >
          Discover campus stories, student opinions, investigative reports, and
          editorial perspectives — all from the CSVTU community.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => router.push(ROUTES.articles)}
            iconRight={
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            }
          >
            Start Reading
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.push(ROUTES.login)}
          >
            Write for Us
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
