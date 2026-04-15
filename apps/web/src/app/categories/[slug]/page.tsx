import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArticleGrid } from "@/components/home/ArticleGrid";
import { getArticles, type ArticleListItem } from "@/lib/api/articles";
import { getCategoryBySlug } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryDetailPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  let articles: ArticleListItem[] = [];
  let errorMessage: string | null = null;

  try {
    articles = await getArticles({ category: slug, perPage: 50 });
  } catch (error) {
    console.error(`[categories/${slug}] Failed to load category articles:`, error);
    errorMessage = "Unable to load this category right now.";
  }

  return (
    <>
      <Navbar />
      <main className="py-12 md:py-16">
        <section className="container-editorial">
          <div className="mb-10 md:mb-12 max-w-3xl">
            <Link
              href={ROUTES.categories}
              className="inline-flex items-center text-sm font-medium text-accent hover:text-accent-hover transition-colors mb-4"
            >
              ← All categories
            </Link>

            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
                aria-hidden="true"
              />
              <span className="text-xs font-medium font-body uppercase tracking-widest text-text-tertiary">
                Category
              </span>
            </div>

            <h1 className="font-heading text-3xl md:text-4xl font-semibold text-text tracking-tight">
              {category.name}
            </h1>

            <p className="font-body text-text-secondary mt-4 leading-relaxed">
              {category.description}
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-error/30 bg-bg-elevated p-8 text-center">
              <p className="font-body text-text-secondary">{errorMessage}</p>
            </div>
          ) : articles.length > 0 ? (
            <ArticleGrid articles={articles} />
          ) : (
            <div className="rounded-xl border border-border-light bg-bg-elevated p-8 text-center">
              <p className="font-body text-text-secondary mb-4">
                No published stories in this category yet.
              </p>
              <Link
                href={ROUTES.write}
                className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
              >
                Write first story
              </Link>
            </div>
          )}

          <section className="mt-12 rounded-2xl border border-border-light bg-surface p-8 md:p-10">
            <div className="max-w-2xl">
              <h2 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight mb-3">
                Publish in {category.name}
              </h2>
              <p className="font-body text-text-secondary leading-relaxed mb-6">
                Have a take, report, or story idea that fits this topic? Write it up and share it
                with the campus.
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
                  Browse latest
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
