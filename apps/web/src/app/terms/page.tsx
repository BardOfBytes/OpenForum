import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { EditorialInfoPage } from "@/components/pages/EditorialInfoPage";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Terms for using OpenForum, including account responsibilities and content standards.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <EditorialInfoPage
        eyebrow="Terms of use"
        title="Use OpenForum as a public campus publishing platform, not a private chat."
        description="By using OpenForum, contributors agree to protect their accounts, publish responsibly, and respect community standards."
        primaryAction={{ href: ROUTES.privacy, label: "Read privacy policy" }}
        secondaryAction={{ href: ROUTES.guidelines, label: "Read guidelines" }}
        sections={[
          {
            title: "Account responsibility",
            body: "Keep your login credentials secure. Activity from your account may be treated as your responsibility, especially when publishing or editing content.",
          },
          {
            title: "Content ownership",
            body: "You retain ownership of your writing while granting OpenForum permission to display, distribute, and archive submitted content on the platform.",
          },
          {
            title: "Platform enforcement",
            body: "OpenForum may remove content or restrict accounts that violate policy, create safety risks, or abuse platform systems.",
          },
          {
            title: "Public visibility",
            body: "Published articles and public interactions may be visible to readers outside the student community. Drafts and protected actions require authentication.",
          },
        ]}
        closing={{
          title: "The rule is simple: publish in a way you can stand behind.",
          body: "The terms, privacy policy, and contributor guidelines work together to keep OpenForum readable, secure, and useful.",
          primaryAction: { href: ROUTES.write, label: "Start writing" },
          secondaryAction: { href: ROUTES.guidelines, label: "Contributor guidelines" },
        }}
      />
      <Footer />
    </>
  );
}
