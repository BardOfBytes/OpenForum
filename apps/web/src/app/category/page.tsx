import { permanentRedirect } from "next/navigation";
import { ROUTES, legacyRedirectFor } from "@/lib/routes";

export default function CategoryLegacyRedirectPage() {
  permanentRedirect(legacyRedirectFor(ROUTES.categoryLegacy) ?? ROUTES.categories);
}
