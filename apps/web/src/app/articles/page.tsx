import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArticleGrid } from "@/components/home/ArticleGrid";
import { getArticles } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  try {
    const articles = await getArticles();

    return (
      <>
        <Navbar />
        <main className="py-12 md:py-16">
          <section className="container-editorial">
            <div className="mb-10 md:mb-12">
              <span className="text-xs font-medium font-body uppercase tracking-widest text-text-tertiary block mb-2">
                OpenForum
              </span>
              <h1 className="font-heading text-3xl md:text-4xl font-semibold text-text tracking-tight">
                Latest Articles
              </h1>
            </div>

            {articles.length > 0 ? (
              <ArticleGrid articles={articles} />
            ) : (
              <div className="rounded-xl border border-border-light bg-bg-elevated p-8 text-center">
                <p className="font-body text-text-secondary">
                  No articles have been published yet.
                </p>
              </div>
            )}
          </section>
        </main>
        <Footer />
      </>
    );
  } catch (error) {
    console.error("[articles] Failed to load articles:", error);

    return (
      <>
        <Navbar />
        <main className="py-12 md:py-16">
          <section className="container-editorial">
            <div className="rounded-xl border border-error/30 bg-bg-elevated p-8">
              <h1 className="font-heading text-2xl font-semibold text-text mb-2">
                Unable to load articles
              </h1>
              <p className="font-body text-text-secondary mb-6">
                Please try again in a moment.
              </p>
              <Link
                href={ROUTES.home}
                className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }
}
