import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CategoryFeedExperience } from "@/components/categories/CategoryFeedExperience";
import { getArticles, type ArticleListItem } from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { getCategoryBySlug } from "@/lib/categories";

export const dynamic = "force-dynamic";

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
