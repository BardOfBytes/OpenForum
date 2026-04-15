/**
 * Article Grid — Client wrapper that applies staggered Framer Motion
 * animations to a grid of ArticleCard components.
 *
 * Separating this from the server page allows the page itself to
 * remain a Server Component while the animation logic is client-side.
 */

"use client";

import { motion } from "framer-motion";
import { ArticleCard } from "@/components/ui/Card";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
};

interface ArticleData {
  title: string;
  excerpt: string;
  slug: string;
  coverImageUrl?: string | null;
  category: { name: string; color?: string };
  author: { name: string; avatarUrl: string | null };
  readTimeMinutes: number;
  publishedAt: string;
}

interface ArticleGridProps {
  articles: ArticleData[];
  /** Maximum number of columns at larger breakpoints. Default: 3. */
  maxColumns?: 2 | 3;
}

export function ArticleGrid({ articles, maxColumns = 3 }: ArticleGridProps) {
  const gridClassName =
    maxColumns === 2
      ? "grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"
      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8";

  return (
    <motion.div
      variants={gridVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className={gridClassName}
    >
      {articles.map((article) => (
        <motion.div key={article.slug} variants={gridItemVariants}>
          <ArticleCard {...article} />
        </motion.div>
      ))}
    </motion.div>
  );
}
