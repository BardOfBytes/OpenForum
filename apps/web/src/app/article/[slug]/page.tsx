import { permanentRedirect } from "next/navigation";
import { ROUTES, legacyRedirectFor } from "@/lib/routes";

interface LegacyArticleRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyArticleRedirectPage({ params }: LegacyArticleRedirectProps) {
  const { slug } = await params;
  permanentRedirect(
    legacyRedirectFor(ROUTES.article.detailLegacy(slug)) ?? ROUTES.article.detail(slug)
  );
}
