import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { EditorialInfoPage } from "@/components/pages/EditorialInfoPage";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how OpenForum works, what we publish, and how students can contribute responsibly.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <EditorialInfoPage
        eyebrow="OpenForum"
        title="A student newsroom built for honest campus conversations."
        description="OpenForum is where CSVTU students report, analyze, and publish stories that matter to their peers."
        primaryAction={{ href: ROUTES.write, label: "Write for OpenForum" }}
        secondaryAction={{ href: ROUTES.guidelines, label: "Read guidelines" }}
        sections={[
          {
            title: "Student voices first",
            body: "The platform is designed for campus reporting, essays, interviews, technical explainers, and opinion pieces from students who want to contribute in public.",
          },
          {
            title: "Editorial standards without gatekeeping",
            body: "OpenForum encourages clarity, evidence, and fair framing. The goal is not to flatten strong opinions, but to make them responsible and readable.",
          },
          {
            title: "A public archive for campus thinking",
            body: "Published work stays accessible so future students can understand what people discussed, questioned, built, and challenged.",
          },
        ]}
        closing={{
          title: "Good campus writing starts with a useful question.",
          body: "Pitch an idea, document a problem, explain a project, or publish an informed take. If it helps students understand their world better, it belongs here.",
          primaryAction: { href: ROUTES.write, label: "Start writing" },
          secondaryAction: { href: ROUTES.articles, label: "Read latest stories" },
        }}
      />
      <Footer />
    </>
  );
}
