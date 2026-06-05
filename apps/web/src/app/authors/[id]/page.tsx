import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ArticleCard } from "@/components/ui/Card";
import { FollowButton } from "@/components/authors/FollowButton";
import { createClient } from "@/lib/supabase/server";
import { getArticles, type ArticleListItem } from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { getPublicUserProfile, type PublicUserProfile } from "@/lib/api/users";
import { ROUTES } from "@/lib/routes";

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
  articles: ArticleListItem[];
} | null> {
  let articles: ArticleListItem[] = [];

  try {
    articles = await getArticles({ perPage: 100 });
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
    bio: profile?.bio ?? null,
    branch: profile?.branch ?? null,
    year: profile?.year ?? null,
    followerCount: profile?.followerCount ?? 0,
    isFollowing: profile?.isFollowing ?? false,
    articles: fallbackAuthor?.articles ?? [],
  };

  const initials = author.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const totalReadTime = author.articles.reduce(
    (total, article) => total + article.readTimeMinutes,
    0
  );
  const primaryCategory = mostFrequentCategory(author.articles);

  return (
    <>
      <Navbar />
      <main className="pb-20 pt-16 md:pb-28">
        <section className="border-b border-border">
          <div className="container-editorial flex flex-col gap-8 py-14 md:flex-row md:items-start md:py-20">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated font-heading text-4xl font-semibold text-accent md:h-40 md:w-40">
              {author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>

            <div className="flex-1">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-accent">
                Author
              </p>
              <h1 className="font-heading text-4xl font-semibold tracking-tight text-text md:text-6xl">
                {author.name}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">
                {author.bio ||
                  "Read published stories, essays, and reporting from this OpenForum contributor."}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-8 border-y border-border py-5">
                <AuthorStat label="Articles" value={author.articles.length} />
                <AuthorStat label="Followers" value={author.followerCount} />
                {author.branch ? <AuthorStat label="Branch" value={author.branch} /> : null}
                {author.year ? <AuthorStat label="Year" value={`Year ${author.year}`} /> : null}
                <AuthorStat label="Read Time" value={`${Math.max(1, totalReadTime)} min`} />
                <AuthorStat label="Main Desk" value={primaryCategory ?? "Mixed"} />
              </div>

              <div className="mt-7">
                <FollowButton
                  authorId={author.id}
                  sessionToken={session?.access_token ?? null}
                  initialFollowing={author.isFollowing}
                  initialFollowerCount={author.followerCount}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="container-editorial py-14 md:py-20">
          <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-text-tertiary">
                Published work
              </p>
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-text">
                Latest from {author.name}
              </h2>
            </div>
            <Link
              href={ROUTES.articles}
              className="hidden text-sm font-semibold text-accent transition-colors hover:text-accent-hover sm:inline-flex"
            >
              Browse all
            </Link>
          </div>

          {author.articles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {author.articles.map((article) => (
                <ArticleCard key={article.slug} {...article} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-bg-elevated px-8 py-14 text-center">
              <h3 className="font-heading text-2xl font-semibold text-text">
                No public articles yet
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
                This author has a profile, but no published OpenForum articles are visible yet.
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function AuthorStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-heading text-2xl font-semibold text-text">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-text-tertiary">
        {label}
      </div>
    </div>
  );
}

function mostFrequentCategory(articles: ArticleListItem[]): string | null {
  const counts = new Map<string, number>();

  for (const article of articles) {
    counts.set(article.category.name, (counts.get(article.category.name) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
