"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, PenSquare, Shield, Zap } from "lucide-react";
import { ArticleCard } from "@/components/articles/ArticleCard";
import type { ArticleListItem } from "@/lib/api/articles";
import type { AuthorSummary } from "@/lib/api/users";
import { ROUTES } from "@/lib/routes";

const pillars = [
  {
    icon: BookOpen,
    title: "Editorial Rigour",
    description:
      "Every piece published on OpenForum is edited for clarity, accuracy, and intellectual honesty. Good writing is a form of respect for the reader.",
  },
  {
    icon: Shield,
    title: "Institutional Trust",
    description:
      "Only verified CSVTu members may write. This keeps our community focused and our discourse grounded in the shared experience of campus life.",
  },
  {
    icon: Zap,
    title: "Student Voice",
    description:
      "OpenForum is not a university mouthpiece. It is a platform for student and faculty perspectives, including perspectives that challenge convention.",
  },
  {
    icon: PenSquare,
    title: "Open Access",
    description:
      "All published articles are freely available. Knowledge produced within CSVTU belongs to everyone, not behind institutional credentials.",
  },
];

interface AboutExperienceProps {
  articleCount: number;
  authorCount: number;
  categoryCount: number;
  notableArticles: ArticleListItem[];
  contributors: AuthorSummary[];
}

export function AboutExperience({
  articleCount,
  authorCount,
  categoryCount,
  notableArticles,
  contributors,
}: AboutExperienceProps) {
  const stats = [
    { value: `${articleCount}+`, label: "Published Articles" },
    { value: String(authorCount), label: "Contributing Authors" },
    { value: String(categoryCount), label: "Categories" },
    { value: "2023", label: "Founded" },
  ];

  return (
    <main className="flex-grow">
      <section className="container mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-primary">
            About OpenForum
          </span>
          <h1 className="mb-6 font-serif text-4xl font-medium leading-[1.1] text-foreground md:text-6xl">
            A platform built for{" "}
            <span className="font-light italic text-primary">ideas worth sharing.</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            OpenForum is the student editorial and journalism platform of UTD CSVTU. It was created
            to give the university community a home for longform thought: articles that take a
            subject seriously, explore it carefully, and write about it with care.
          </p>
        </motion.div>
      </section>

      <section className="border-y border-border bg-card/60 py-10">
        <div className="container mx-auto max-w-4xl px-4 md:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="mb-1 font-serif text-3xl font-medium text-primary md:text-4xl">
                  {value}
                </div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-4xl px-4 py-20 md:px-8">
        <div className="grid items-start gap-12 md:grid-cols-2">
          <div>
            <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Our Mission
            </span>
            <h2 className="mb-5 font-serif text-3xl font-medium leading-tight">
              Cultivating an intellectual culture at CSVTU
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Technical education often narrows the aperture of what students are encouraged to
              think about. We believe engineering, science, and mathematics are inseparable from
              history, culture, ethics, and the arts.
            </p>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              OpenForum exists to make space for the full range of student inquiry, not just the
              coursework, but the questions that arise in its margins.
            </p>
            <Link
              href={ROUTES.write}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PenSquare className="h-4 w-4" />
              Start Writing
            </Link>
          </div>

          <div className="space-y-1">
            <blockquote className="mb-6 border-l-4 border-primary py-2 pl-6">
              <p className="font-serif text-xl italic leading-relaxed text-foreground/80">
                &ldquo;The goal is not to produce content. It is to produce understanding.&rdquo;
              </p>
            </blockquote>
            <p className="pl-6 text-sm text-muted-foreground">
              - OpenForum Editorial Charter, 2023
            </p>
          </div>
        </div>
      </section>

      {contributors.length > 0 && (
        <section className="container mx-auto max-w-5xl px-4 py-20 md:px-8">
          <div className="mb-10 flex flex-col gap-3 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Contributors
              </span>
              <h2 className="font-serif text-3xl font-medium md:text-4xl">
                People writing OpenForum
              </h2>
            </div>
            <Link href={ROUTES.articles} className="text-sm font-medium text-primary hover:underline">
              Read their work
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {contributors.slice(0, 3).map((author, index) => (
              <motion.div
                key={author.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
              >
                <Link
                  href={ROUTES.author.detail(author.id)}
                  className="group block h-full border-b border-border pb-6 transition-colors hover:border-primary"
                >
                  <div className="mb-5 flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card font-serif text-lg font-medium text-primary transition-colors group-hover:border-primary/50">
                      {author.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={author.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(author.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-serif text-xl font-medium transition-colors group-hover:text-primary">
                        {author.name}
                      </h3>
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {author.headline || "OpenForum Author"}
                      </p>
                    </div>
                  </div>

                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {author.bio ||
                      "Published essays, reporting, and ideas for the CSVTU community."}
                  </p>

                  <div className="mt-5 flex items-center gap-5 text-xs text-muted-foreground">
                    <span>
                      <strong className="font-semibold text-foreground">
                        {author.articlesPublished}
                      </strong>{" "}
                      articles
                    </span>
                    <span>
                      <strong className="font-semibold text-foreground">
                        {author.totalViews}
                      </strong>{" "}
                      views
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-border bg-card/40 py-20">
        <div className="container mx-auto max-w-4xl px-4 md:px-8">
          <span className="mb-4 block text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
            What We Stand For
          </span>
          <h2 className="mb-12 text-center font-serif text-3xl font-medium">
            Four principles that guide every piece
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, description }, index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex gap-4"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="mb-2 font-serif text-lg font-medium">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {notableArticles.length > 0 && (
        <section className="border-b border-border bg-card/40 py-20">
          <div className="container mx-auto max-w-4xl px-4 md:px-8">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="font-serif text-2xl font-medium">Notable Pieces</h2>
              <Link href={ROUTES.articles} className="text-sm font-medium text-primary hover:underline">
                Browse all
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {notableArticles.map((article, index) => (
                <ArticleCard key={article.slug} article={article} index={index} featured />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container mx-auto max-w-4xl px-4 pb-16 pt-20 text-center md:px-8">
        <h2 className="mb-4 font-serif text-3xl font-medium md:text-4xl">
          Ready to contribute?
        </h2>
        <p className="mx-auto mb-8 max-w-md leading-relaxed text-muted-foreground">
          If you hold a CSVTu institutional email address, you are eligible to publish on
          OpenForum. All it takes is an idea worth sharing.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href={ROUTES.write}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PenSquare className="h-4 w-4" />
            Write your first piece
          </Link>
          <Link
            href={ROUTES.articles}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <BookOpen className="h-4 w-4" />
            Read the archives
          </Link>
        </div>
      </section>
    </main>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
