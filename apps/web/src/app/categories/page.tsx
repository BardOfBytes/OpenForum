import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CategoriesExperience } from "@/components/categories/CategoriesExperience";
import { getArticlesPage, type ArticleListItem } from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { CATEGORY_CATALOG, categorySlugFromName } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Categories",
};

export const revalidate = 60;

interface CategorySnapshot {
  count: number;
  latest: ArticleListItem | null;
}

async function getCategorySnapshots(): Promise<{
  snapshots: Map<string, CategorySnapshot>;
  errorMessage: string | null;
}> {
  try {
    const snapshots = new Map<string, CategorySnapshot>();

    const results = await Promise.allSettled(
      CATEGORY_CATALOG.map(async (category) => {
        const page = await getArticlesPage({
          category: categorySlugFromName(category.name),
          page: 1,
          perPage: 1,
        });

        return {
          slug: category.slug,
          count: page.total,
          latest: page.data[0] ?? null,
        };
      })
    );

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const slug = CATEGORY_CATALOG[index].slug;
      if (result.status === "fulfilled") {
        snapshots.set(slug, {
          count: result.value.count,
          latest: result.value.latest,
        });
      } else {
        snapshots.set(slug, { count: 0, latest: null });
      }
    }

    return { snapshots, errorMessage: null };
  } catch (error) {
    if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
      console.error("[categories] Failed to load category snapshots:", error);
    }
    return {
      snapshots: new Map(),
      errorMessage: "Categories are temporarily unavailable.",
    };
  }
}

export default async function CategoriesPage() {
  const { snapshots, errorMessage } = await getCategorySnapshots();

  return (
    <>
      <Navbar />
      <CategoriesExperience
        categories={CATEGORY_CATALOG}
        snapshots={Array.from(snapshots.entries())}
        errorMessage={errorMessage}
      />
      <Footer />
    </>
  );
}
