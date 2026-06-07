import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PublicAuthorProfileExperience } from "@/components/authors/PublicAuthorProfileExperience";
import { createClient } from "@/lib/supabase/server";
import { getArticles, type ArticleListItem } from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { getPublicUserProfile, type PublicUserProfile } from "@/lib/api/users";

interface AuthorPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { id } = await params;
  const { profile, fallbackAuthor } = await loadAuthorPageData(id);
  const authorName = profile?.name ?? fallbackAuthor?.name;

  if (!authorName) {
    return { title: "Author" };
  }

  return {
    title: authorName,
    description: `Read articles by ${authorName} on OpenForum.`,
  };
}

async function findAuthor(authorId: string): Promise<{
  id: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  createdAt: string | null;
  articles: ArticleListItem[];
} | null> {
  let articles: ArticleListItem[] = [];

  try {
    articles = await getArticles({ perPage: 100, author: authorId });
  } catch (error) {
    if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
      console.error("[authors] Failed to load articles:", error);
    }
    return null;
  }

  const authorArticles = articles.filter((article) => article.author.id === authorId);
  const first = authorArticles[0];

  if (!first?.author.id) {
    return null;
  }

  return {
    id: first.author.id,
    name: first.author.name,
    avatarUrl: first.author.avatarUrl,
    headline: first.author.headline ?? null,
    createdAt: null,
    articles: authorArticles,
  };
}

async function loadAuthorPageData(
  authorId: string,
  accessToken?: string | null
): Promise<{
  profile: PublicUserProfile | null;
  fallbackAuthor: Awaited<ReturnType<typeof findAuthor>>;
}> {
  const [profileResult, fallbackAuthor] = await Promise.allSettled([
    getPublicUserProfile(authorId, accessToken),
    findAuthor(authorId),
  ]);

  return {
    profile: profileResult.status === "fulfilled" ? profileResult.value : null,
    fallbackAuthor: fallbackAuthor.status === "fulfilled" ? fallbackAuthor.value : null,
  };
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { profile, fallbackAuthor } = await loadAuthorPageData(id, session?.access_token);

  if (!profile && !fallbackAuthor) {
    notFound();
  }

  const author = {
    id,
    name: profile?.name ?? fallbackAuthor?.name ?? "Unknown Author",
    avatarUrl: profile?.avatarUrl ?? fallbackAuthor?.avatarUrl ?? null,
    headline: profile?.headline ?? fallbackAuthor?.headline ?? null,
    bio: profile?.bio ?? null,
    followerCount: profile?.followerCount ?? 0,
    isFollowing: profile?.isFollowing ?? false,
    createdAt: profile?.createdAt ?? fallbackAuthor?.createdAt ?? null,
    articles: fallbackAuthor?.articles ?? [],
  };

  const totalReadTime = author.articles.reduce(
    (total, article) => total + article.readTimeMinutes,
    0
  );
  const totalViews = author.articles.reduce((total, article) => total + article.views, 0);
  const primaryCategory = mostFrequentCategory(author.articles);

  return (
    <>
      <Navbar />
      <PublicAuthorProfileExperience
        author={{
          ...author,
          totalReadTime,
          totalViews,
          primaryCategory,
        }}
        sessionToken={session?.access_token ?? null}
      />
      <Footer />
    </>
  );
}

function mostFrequentCategory(articles: ArticleListItem[]): string | null {
  const counts = new Map<string, number>();

  for (const article of articles) {
    counts.set(article.category.name, (counts.get(article.category.name) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
