import { permanentRedirect } from "next/navigation";
import { ROUTES, legacyRedirectFor } from "@/lib/routes";

interface CategoryLegacyDetailRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryLegacyDetailRedirectPage({
  params,
}: CategoryLegacyDetailRedirectProps) {
  const { slug } = await params;
  permanentRedirect(
    legacyRedirectFor(ROUTES.category.detailLegacy(slug)) ?? ROUTES.category.detail(slug)
  );
}
