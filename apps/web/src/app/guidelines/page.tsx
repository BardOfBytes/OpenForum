import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { EditorialInfoPage } from "@/components/pages/EditorialInfoPage";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Guidelines",
  description:
    "Editorial and contribution guidelines for publishing responsible student journalism on OpenForum.",
};

export default function GuidelinesPage() {
  return (
    <>
      <Navbar />
      <EditorialInfoPage
        eyebrow="Contributor guidelines"
        title="Publish clearly, fairly, and with enough evidence to earn trust."
        description="These standards keep OpenForum useful for readers while giving contributors room to report, argue, and experiment."
        primaryAction={{ href: ROUTES.write, label: "Start writing" }}
        secondaryAction={{ href: ROUTES.articles, label: "Read examples" }}
        sections={[
          {
            title: "Accuracy first",
            body: "Verify claims before publishing. Separate reporting from opinion, avoid misleading headlines, and link or name sources when readers need context.",
          },
          {
            title: "Respect and fairness",
            body: "Critique decisions, systems, and ideas directly. Avoid personal attacks, discriminatory framing, harassment, and speculation about private lives.",
          },
          {
            title: "Transparency",
            body: "Disclose conflicts of interest. If a story changes after publishing, make the correction clear instead of hiding the edit.",
          },
          {
            title: "Readable structure",
            body: "Use a precise headline, a direct opening, and paragraphs that move one idea at a time. Readers should understand the purpose within the first few lines.",
          },
        ]}
        closing={{
          title: "Strong writing is welcome. Careless writing is not.",
          body: "OpenForum can host sharp disagreement when it is honest, sourced, and written with respect for the community reading it.",
          primaryAction: { href: ROUTES.write, label: "Write responsibly" },
          secondaryAction: { href: ROUTES.about, label: "About OpenForum" },
        }}
      />
      <Footer />
    </>
  );
}
