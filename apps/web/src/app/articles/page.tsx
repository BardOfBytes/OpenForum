import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArticlesExplorer } from "@/components/articles/ArticlesExplorer";
import { getArticles } from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Articles",
};

export const revalidate = 60;

export default async function ArticlesPage() {
  try {
    const articles = await getArticles();

    return (
      <>
        <Navbar />
        <main className="py-12 md:py-16">
          <section className="container-editorial">
            {articles.length > 0 ? (
              <ArticlesExplorer articles={articles} />
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
    if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
      console.error("[articles] Failed to load articles:", error);
    }

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
