import { permanentRedirect } from "next/navigation";
import { ROUTES, legacyRedirectFor } from "@/lib/routes";

export default function ArticleNewLegacyRedirectPage() {
  permanentRedirect(legacyRedirectFor(ROUTES.articleNewLegacy) ?? ROUTES.write);
}
