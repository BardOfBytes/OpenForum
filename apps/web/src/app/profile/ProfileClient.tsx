"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Loader2, PenSquare, Save, Settings } from "lucide-react";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { ApiBaseUrlConfigurationError, apiUrl } from "@/lib/api/base-url";
import type { ArticleListItem } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  roll_number: string | null;
  branch: string | null;
  year: number | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  follower_count: number;
}

interface ProfileClientProps {
  sessionToken: string;
  articles: ArticleListItem[];
}

type ProfileTab = "published" | "drafts" | "settings";

export function ProfileClient({ sessionToken, articles }: ProfileClientProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({
    name: "",
    roll_number: "",
    branch: "",
    year: "",
    headline: "",
    bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("published");

  const publishedArticles = useMemo(() => {
    if (!profile) {
      return [];
    }

    return articles.filter((article) => article.author.id === profile.id);
  }, [articles, profile]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiUrl("/api/v1/users/me"), {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });

        if (!response.ok) {
          throw new Error(`Could not load profile (HTTP ${response.status}).`);
        }

        const data = (await response.json()) as UserProfile;
        if (cancelled) {
          return;
        }

        setProfile(data);
        setForm({
          name: data.name ?? "",
          roll_number: data.roll_number ?? "",
          branch: data.branch ?? "",
          year: data.year ? String(data.year) : "",
          headline: data.headline ?? "",
          bio: data.bio ?? "",
        });
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(
          err instanceof ApiBaseUrlConfigurationError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Profile could not be loaded."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const year = form.year.trim() ? Number(form.year) : null;
      const response = await fetch(apiUrl("/api/v1/users/me"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: form.name.trim() || null,
          roll_number: form.roll_number.trim() || null,
          branch: form.branch.trim() || null,
          year,
          headline: form.headline.trim() || null,
          bio: form.bio.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Profile update failed (HTTP ${response.status}).`);
      }

      const data = (await response.json()) as UserProfile;
      setProfile(data);
      setForm({
        name: data.name ?? "",
        roll_number: data.roll_number ?? "",
        branch: data.branch ?? "",
        year: data.year ? String(data.year) : "",
        headline: data.headline ?? "",
        bio: data.bio ?? "",
      });
      setMessage("Profile updated.");
    } catch (err) {
      setError(
        err instanceof ApiBaseUrlConfigurationError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Profile update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-grow">
        <div className="container mx-auto max-w-4xl px-4 py-24 md:px-8">
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading profile
          </div>
        </div>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="flex-grow">
        <div className="container mx-auto max-w-4xl px-4 py-24 md:px-8">
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const initials = (profile?.name || profile?.email || "S")
    .split(/[.\s@_-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const totalViews = publishedArticles.reduce((total, article) => total + article.views, 0);
  const followerCount = profile?.follower_count ?? 0;

  return (
    <main className="flex-grow">
      <section className="container mx-auto max-w-4xl px-4 py-12 md:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card font-serif text-4xl font-medium text-primary md:h-40 md:w-40">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <div className="flex-1">
            <h1 className="mb-3 font-serif text-4xl font-medium tracking-normal text-foreground md:text-5xl">
              {profile?.name || "OpenForum Student"}
            </h1>

            <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="font-semibold uppercase tracking-[0.2em] text-primary">
                {profile?.headline || "CSVTU Student"}
              </span>
              {profile?.branch ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                  <span>{profile.branch}</span>
                </>
              ) : null}
              {profile?.year ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                  <span>Year {profile.year}</span>
                </>
              ) : null}
            </div>

            <p className="mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {profile?.bio ||
                "Add a short bio so readers know the person behind your reporting and essays."}
            </p>

            <div className="flex flex-wrap items-center gap-6 border-y border-border py-6 md:gap-8">
              <ProfileStat label="Articles" value={publishedArticles.length} />
              <div className="h-10 w-px bg-border" />
              <ProfileStat label="Views" value={totalViews} />
              <div className="h-10 w-px bg-border" />
              <ProfileStat label="Followers" value={followerCount} />
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto mb-24 max-w-6xl px-4 md:px-8">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-border">
          <div className="flex items-center gap-8 overflow-x-auto">
            <ProfileTabButton
              active={activeTab === "published"}
              onClick={() => setActiveTab("published")}
            >
              Published
            </ProfileTabButton>
            <ProfileTabButton
              active={activeTab === "drafts"}
              onClick={() => setActiveTab("drafts")}
            >
              Drafts
            </ProfileTabButton>
            <ProfileTabButton
              active={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
            >
              Edit Profile
            </ProfileTabButton>
          </div>

          <Link
            href={ROUTES.write}
            className="mb-3 hidden shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted md:inline-flex"
          >
            <PenSquare className="h-4 w-4" />
            Write
          </Link>
        </div>

        {activeTab === "published" ? (
          publishedArticles.length > 0 ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {publishedArticles.map((article, index) => (
                <ArticleCard key={article.slug} article={article} index={index} />
              ))}
            </div>
          ) : (
            <EmptyProfilePanel
              title="No published articles yet"
              description="Publish your first essay, report, or campus note and it will appear here."
              actionHref={ROUTES.write}
              actionLabel="Start writing"
            />
          )
        ) : null}

        {activeTab === "drafts" ? (
          <EmptyProfilePanel
            title="Drafts are managed in the writer"
            description="Open the writing desk to continue an unpublished article or create a new one."
            actionHref={ROUTES.write}
            actionLabel="Open writer"
          />
        ) : null}

        {activeTab === "settings" ? (
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 md:p-8"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Profile settings
                </p>
                <h2 className="font-serif text-3xl font-medium text-foreground">
                  Edit profile
                </h2>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                <Settings className="h-4 w-4" />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <ProfileField
                label="Display name"
                value={form.name}
                onChange={(value) =>
                  setForm((current) => ({ ...current, name: value }))
                }
                placeholder="Your name"
              />
              <ProfileField
                label="Roll number"
                value={form.roll_number}
                onChange={(value) =>
                  setForm((current) => ({ ...current, roll_number: value }))
                }
                placeholder="CSVTU roll number"
              />
              <ProfileField
                label="Branch"
                value={form.branch}
                onChange={(value) =>
                  setForm((current) => ({ ...current, branch: value }))
                }
                placeholder="Computer Science"
              />
              <ProfileField
                label="Year"
                value={form.year}
                onChange={(value) =>
                  setForm((current) => ({ ...current, year: value }))
                }
                placeholder="1-8"
                inputMode="numeric"
              />
              <div className="md:col-span-2">
                <ProfileField
                  label="Headline"
                  value={form.headline}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, headline: value }))
                  }
                  placeholder="Student reporter, AI editor, campus critic"
                />
              </div>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Bio
              </span>
              <textarea
                value={form.bio}
                onChange={(event) =>
                  setForm((current) => ({ ...current, bio: event.target.value }))
                }
                rows={5}
                placeholder="What do you write about?"
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {message ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    {message}
                  </p>
                ) : null}
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save profile
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function ProfileTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative py-4 text-sm font-semibold uppercase tracking-[0.18em] transition-colors hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
      <span
        className={`absolute inset-x-0 bottom-0 h-0.5 bg-primary transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </button>
  );
}

function EmptyProfilePanel({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-8 py-24 text-center">
      <h3 className="font-serif text-3xl font-medium text-foreground">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Link
        href={actionHref}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <PenSquare className="h-4 w-4" />
        {actionLabel}
      </Link>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-serif text-2xl font-medium text-foreground">
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
