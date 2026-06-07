import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getArticleBySlug } from "@/lib/api/articles";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/routes";
import { isAllowedInstitutionalEmail } from "@/lib/auth/allowed-email";
import WriteForm from "./WriteForm";

export const metadata: Metadata = {
  title: "Write",
};

interface WritePageProps {
  searchParams?: {
    slug?: string;
  };
}

function roleCanManageAll(role: unknown): boolean {
  return role === "editor" || role === "admin";
}

function userRole(
  user: { app_metadata?: Record<string, unknown>; user_role?: unknown } | null | undefined
): unknown {
  return (
    user?.app_metadata?.role ??
    user?.app_metadata?.user_role ??
    (user as { user_role?: unknown } | undefined)?.user_role
  );
}

export default async function WritePage({ searchParams }: WritePageProps) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.write)}`);
  }

  // Double check domain rule natively
  const email = user.email || "";
  if (!isAllowedInstitutionalEmail(email)) {
    redirect(`${ROUTES.auth.error}?reason=domain`);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect(`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.write)}`);
  }

  // We extract the access_token so the client boundary can pass it to the external Axum API
  const sessionToken = session.access_token;
  const editSlug = searchParams?.slug?.trim();
  const article = editSlug
    ? await getArticleBySlug(editSlug).catch(() => null)
    : null;

  if (editSlug && !article) {
    redirect(ROUTES.articles);
  }

  if (article) {
    const isAuthor = article.author.id === user.id;
    if (!isAuthor && !roleCanManageAll(userRole(user))) {
      redirect(ROUTES.article.detail(article.slug));
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <WriteForm sessionToken={sessionToken} initialArticle={article} />
    </div>
  );
}
