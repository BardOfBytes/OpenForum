/**
 * Article Grid — Client wrapper for animated ArticleCard grids.
 *
 * ArticleCard owns its entrance animation, so this grid intentionally
 * avoids wrapping each card in another motion container.
 */

import { ArticleCard } from "@/components/articles/ArticleCard";
import type { ArticleListItem } from "@/lib/api/articles";

interface ArticleGridProps {
  articles: ArticleListItem[];
  /** Maximum number of columns at larger breakpoints. Default: 3. */
  maxColumns?: 2 | 3;
}

export function ArticleGrid({ articles, maxColumns = 3 }: ArticleGridProps) {
  const gridClassName =
    maxColumns === 2
      ? "grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"
      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8";

  return (
    <div className={gridClassName}>
      {articles.map((article, index) => (
        <ArticleCard key={article.slug} article={article} index={index} />
      ))}
    </div>
  );
}
