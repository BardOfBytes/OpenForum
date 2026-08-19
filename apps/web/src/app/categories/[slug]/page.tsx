import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CategoryFeedExperience } from "@/components/categories/CategoryFeedExperience";
import { getArticles, type ArticleListItem } from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { CATEGORY_CATALOG, getCategoryBySlug } from "@/lib/categories";

// No request-scoped data here either — revalidate instead of force-dynamic so
// the route stays prefetchable. See the note in src/app/page.tsx.
export const revalidate = 60;

// The category catalog is a fixed list, so every category page can be
// prerendered at build time. Without this, a dynamic segment has nothing to
// prefetch and no prerendered HTML, so each visit paid a full server render.
export function generateStaticParams() {
  return CATEGORY_CATALOG.map((category) => ({ slug: category.slug }));
}

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return {
      title: "Categories",
    };
  }

  return {
    title: category.name,
    description: category.description,
  };
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
    if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
      console.error(`[categories/${slug}] Failed to load category articles:`, error);
    }
    errorMessage = "Unable to load this category right now.";
  }

  return (
    <>
      <Navbar />
      <CategoryFeedExperience
        category={category}
        articles={articles}
        errorMessage={errorMessage}
      />
      <Footer />
    </>
  );
}
