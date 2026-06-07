import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex-grow">
        <section className="container mx-auto max-w-4xl px-4 py-20 text-center md:px-8 md:py-28">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-primary">
            404
          </p>
          <h1 className="mx-auto max-w-3xl font-serif text-4xl font-medium leading-tight text-foreground md:text-6xl">
            This page drifted out of the archive.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            The story may have moved, or the link may no longer exist. Return to the archive and
            keep reading.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={ROUTES.articles}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Search className="h-4 w-4" />
              Browse articles
            </Link>
            <Link
              href={ROUTES.home}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Return home
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
