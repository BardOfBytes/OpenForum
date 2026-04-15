import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/routes";
import { isAllowedInstitutionalEmail } from "@/lib/auth/allowed-email";
import WriteForm from "./WriteForm";

export const metadata: Metadata = {
  title: "Write",
};

export default async function WritePage() {
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

  return (
    <div className="min-h-screen bg-[#fcfbf9]">
      <WriteForm sessionToken={sessionToken} />
    </div>
  );
}
