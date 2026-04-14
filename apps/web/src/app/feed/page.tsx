import { permanentRedirect } from "next/navigation";
import { ROUTES, legacyRedirectFor } from "@/lib/routes";

export default function FeedLegacyRedirectPage() {
  permanentRedirect(legacyRedirectFor(ROUTES.feedLegacy) ?? ROUTES.articles);
}
