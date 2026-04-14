/**
 * Categories Bar — Horizontal scrollable pill navigation
 *
 * Client component for interactive scroll behavior and subtle
 * hover animations on the category pills.
 */

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { CATEGORY_CATALOG } from "@/lib/categories";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const pillVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE },
  },
};

export function CategoriesBar() {
  return (
    <section className="py-16 md:py-20" aria-label="Browse by category">
      <div className="container-editorial">
        {/* Section header */}
        <div className="flex items-center gap-4 mb-8">
          <h2 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight shrink-0">
            Explore Topics
          </h2>
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>

        {/* Scrollable pill row */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide"
          role="navigation"
          aria-label="Category navigation"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {CATEGORY_CATALOG.map((cat) => (
            <motion.div key={cat.slug} variants={pillVariants}>
              <Link
                href={ROUTES.category.detail(cat.slug)}
                className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-border bg-bg-elevated hover:border-transparent transition-all duration-normal shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{
                  // On hover, use the category color for the border
                  // Handled via inline style + group hover in tailwind
                }}
              >
                {/* Color dot */}
                <span
                  className="w-2 h-2 rounded-full shrink-0 transition-transform duration-normal group-hover:scale-125"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium font-body text-text-secondary group-hover:text-text transition-colors duration-fast whitespace-nowrap">
                  {cat.name}
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
