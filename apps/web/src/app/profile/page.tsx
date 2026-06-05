import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";
import { isAllowedInstitutionalEmail } from "@/lib/auth/allowed-email";
import { getArticles, type ArticleListItem } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";
import { ProfileClient } from "./ProfileClient";

export const metadata: Metadata = {
  title: "Profile",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.profile)}`);
  }

  const email = user.email || "";
  if (!isAllowedInstitutionalEmail(email)) {
    redirect(`${ROUTES.auth.error}?reason=domain`);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.profile)}`);
  }

  let articles: ArticleListItem[] = [];
  try {
    articles = await getArticles({ perPage: 50 });
  } catch (error) {
    console.error("[profile] Failed to load articles:", error);
  }

  return (
    <>
      <Navbar />
      <ProfileClient sessionToken={session.access_token} articles={articles} />
      <Footer />
    </>
  );
}
