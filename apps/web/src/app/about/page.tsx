import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { AboutExperience } from "@/components/pages/AboutExperience";
import { getArticlesPage, type ArticleListItem } from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { getAuthors, type AuthorSummary } from "@/lib/api/users";
import { CATEGORY_CATALOG } from "@/lib/categories";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how OpenForum works, what we publish, and how students can contribute responsibly.",
};

export default async function AboutPage() {
  let articleCount = 0;
  let notableArticles: ArticleListItem[] = [];
  let contributors: AuthorSummary[] = [];

  try {
    const page = await getArticlesPage({ page: 1, perPage: 8 });
    articleCount = page.total;
    notableArticles = page.data.slice(0, 2);
  } catch (error) {
    if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
      console.error("[about] Failed to load article stats:", error);
    }
  }

  try {
    contributors = await getAuthors();
  } catch (error) {
    if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
      console.error("[about] Failed to load contributors:", error);
    }
  }

  const authorCount =
    contributors.length ||
    new Set(notableArticles.map((article) => article.author.id ?? article.author.name)).size;
  const visibleContributors =
    contributors.length > 0 ? contributors : contributorsFromArticles(notableArticles);

  return (
    <>
      <Navbar />
      <AboutExperience
        articleCount={articleCount}
        authorCount={authorCount}
        categoryCount={CATEGORY_CATALOG.length}
        notableArticles={notableArticles}
        contributors={visibleContributors}
      />
      <Footer />
    </>
  );
}

function contributorsFromArticles(articles: ArticleListItem[]): AuthorSummary[] {
  const authors = new Map<string, AuthorSummary>();

  for (const article of articles) {
    const key = article.author.id ?? article.author.name;
    const existing = authors.get(key);

    if (existing) {
      existing.articlesPublished += 1;
      existing.totalViews += article.views;
      continue;
    }

    authors.set(key, {
      id: article.author.id ?? key,
      name: article.author.name,
      username: article.author.username ?? null,
      avatarUrl: article.author.avatarUrl,
      headline: article.author.headline ?? null,
      bio: article.author.bio ?? null,
      articlesPublished: 1,
      totalViews: article.views,
      followerCount: 0,
    });
  }

  return Array.from(authors.values()).slice(0, 3);
}
