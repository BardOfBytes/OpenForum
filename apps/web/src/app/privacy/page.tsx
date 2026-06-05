import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { EditorialInfoPage } from "@/components/pages/EditorialInfoPage";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Privacy practices for OpenForum, including account data, content metadata, and usage information.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <EditorialInfoPage
        eyebrow="Privacy"
        title="We collect only what OpenForum needs to authenticate and operate."
        description="OpenForum is public by design for published writing, but contributor access and platform operations should stay restrained."
        primaryAction={{ href: ROUTES.terms, label: "Read terms" }}
        secondaryAction={{ href: ROUTES.guidelines, label: "Read guidelines" }}
        sections={[
          {
            title: "Account data",
            body: "We store account identifiers, institutional email, profile fields, and authentication metadata needed to confirm student access and render author information.",
          },
          {
            title: "Published content",
            body: "Articles, comments, likes, bookmarks, and follows are stored so the platform can display content and maintain interaction history.",
          },
          {
            title: "Operational logs",
            body: "Technical logs may be kept for debugging, security, abuse prevention, and performance monitoring. They should not be used as a public profile of a student.",
          },
          {
            title: "Control and corrections",
            body: "Students can update their profile details and request corrections to published work when something is inaccurate or incomplete.",
          },
        ]}
        closing={{
          title: "Privacy and accountability should reinforce each other.",
          body: "OpenForum keeps public publishing visible while limiting platform data use to authentication, safety, reliability, and content display.",
          primaryAction: { href: ROUTES.terms, label: "Read terms" },
          secondaryAction: { href: ROUTES.about, label: "About OpenForum" },
        }}
      />
      <Footer />
    </>
  );
}
