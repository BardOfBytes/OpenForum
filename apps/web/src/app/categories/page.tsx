import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getArticlesPage, type ArticleListItem } from "@/lib/api/articles";
import { CATEGORY_CATALOG, categorySlugFromName } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

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
    console.error("[categories] Failed to load category snapshots:", error);
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
      <main className="py-12 md:py-16">
        <section className="container-editorial">
          <div className="mb-10 md:mb-12 max-w-2xl">
            <span className="text-xs font-medium font-body uppercase tracking-widest text-text-tertiary block mb-2">
              OpenForum
            </span>
            <h1 className="font-heading text-3xl md:text-4xl font-semibold text-text tracking-tight">
              Categories
            </h1>
            <p className="font-body text-text-secondary mt-4 leading-relaxed">
              Explore stories by topic and dive into the conversations shaping campus life.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-error/30 bg-bg-elevated p-8 text-center">
              <p className="font-body text-text-secondary">{errorMessage}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
              {CATEGORY_CATALOG.map((category) => {
                const snapshot = snapshots.get(category.slug) ?? {
                  count: 0,
                  latest: null,
                };

                return (
                  <Link
                    key={category.slug}
                    href={ROUTES.category.detail(category.slug)}
                    className="group rounded-xl border border-border-light bg-bg-elevated p-6 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                        aria-hidden="true"
                      />
                      <h2 className="font-heading text-xl text-text group-hover:text-accent transition-colors">
                        {category.name}
                      </h2>
                    </div>

                    <p className="font-body text-sm text-text-secondary leading-relaxed mb-4">
                      {category.description}
                    </p>

                    <div className="text-xs text-text-tertiary font-body uppercase tracking-wide mb-3">
                      {snapshot.count} article{snapshot.count === 1 ? "" : "s"}
                    </div>

                    {snapshot.latest ? (
                      <p className="font-body text-sm text-text line-clamp-2">
                        Latest: {snapshot.latest.title}
                      </p>
                    ) : (
                      <p className="font-body text-sm text-text-secondary">
                        No articles yet.
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          <section className="mt-12 rounded-2xl border border-border-light bg-surface p-8 md:p-10">
            <div className="max-w-2xl">
              <h2 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight mb-3">
                Pick a lane. Add your voice.
              </h2>
              <p className="font-body text-text-secondary leading-relaxed mb-6">
                Choose the category that fits your idea and publish a story that moves the campus
                conversation forward.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={ROUTES.write}
                  className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
                >
                  Start writing
                </Link>
                <Link
                  href={ROUTES.articles}
                  className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-bg-elevated transition-colors"
                >
                  View latest articles
                </Link>
              </div>
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </>
  );
}
