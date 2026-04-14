import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ApiHttpError, getArticleBySlug } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

interface ArticleDetailPageProps {
  params: Promise<{ slug: string }>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;

  try {
    const article = await getArticleBySlug(slug);

    return (
      <>
        <Navbar />
        <main className="py-12 md:py-16">
          <article className="container-narrow">
            <div className="mb-8">
              <span
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium font-body"
                style={{
                  backgroundColor: `${article.category.color}22`,
                  color: article.category.color,
                }}
              >
                {article.category.name}
              </span>

              <h1 className="font-heading text-3xl md:text-5xl font-semibold text-text tracking-tight mt-4">
                {article.title}
              </h1>

              <p className="font-body text-text-secondary mt-4 text-lg leading-relaxed">
                {article.excerpt}
              </p>

              <div className="mt-6 text-sm text-text-tertiary font-body">
                <span>{article.author.name}</span>
                <span className="mx-2">·</span>
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                <span className="mx-2">·</span>
                <span>{article.readTimeMinutes} min read</span>
              </div>
            </div>

            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: article.body }}
            />

            {article.tags.length > 0 && (
              <div className="mt-12 pt-6 border-t border-border-light">
                <h2 className="font-body text-sm uppercase tracking-widest text-text-tertiary mb-3">
                  Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>
        </main>
        <Footer />
      </>
    );
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 404) {
      notFound();
    }

    return (
      <>
        <Navbar />
        <main className="py-12 md:py-16">
          <section className="container-editorial">
            <div className="rounded-xl border border-error/30 bg-bg-elevated p-8">
              <h1 className="font-heading text-2xl font-semibold text-text mb-2">
                Could not load this article
              </h1>
              <p className="font-body text-text-secondary mb-6">
                Please try again in a few minutes.
              </p>
              <Link
                href={ROUTES.articles}
                className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
              >
                Back to Articles
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }
}
