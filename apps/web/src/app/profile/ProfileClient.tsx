"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type HTMLAttributes,
} from "react";
import Link from "next/link";
import { Loader2, PenSquare, Save } from "lucide-react";
import { ArticleCard } from "@/components/ui/Card";
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
  bio: string | null;
}

interface ProfileClientProps {
  sessionToken: string;
  articles: ArticleListItem[];
}

export function ProfileClient({ sessionToken, articles }: ProfileClientProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({
    name: "",
    roll_number: "",
    branch: "",
    year: "",
    bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <div className="container-editorial py-24">
        <div className="flex items-center justify-center gap-3 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading profile
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="container-editorial py-24">
        <div className="rounded-2xl border border-error/30 bg-bg-elevated p-8 text-center">
          <p className="text-sm text-error">{error}</p>
        </div>
      </div>
    );
  }

  const initials = (profile?.name || profile?.email || "S")
    .split(/[.\s@_-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="py-12 md:py-16">
      <section className="container-editorial">
        <div className="flex flex-col gap-8 border-b border-border pb-12 md:flex-row md:items-start">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated font-heading text-4xl font-semibold text-accent md:h-40 md:w-40">
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
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-accent">
              Student profile
            </p>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-text md:text-5xl">
              {profile?.name || "OpenForum Student"}
            </h1>
            <p className="mt-3 text-sm text-text-secondary">{profile?.email}</p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">
              {profile?.bio ||
                "Add a short bio so readers know the person behind your reporting and essays."}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-8 border-y border-border py-5">
              <ProfileStat label="Articles" value={publishedArticles.length} />
              <ProfileStat label="Branch" value={profile?.branch || "Not set"} />
              <ProfileStat label="Year" value={profile?.year ? `Year ${profile.year}` : "Not set"} />
            </div>
          </div>
        </div>
      </section>

      <section className="container-editorial grid gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-text">
              Edit profile
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              These details appear with your articles and help readers understand your academic context.
            </p>
          </div>

          <ProfileField
            label="Display name"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
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
            onChange={(value) => setForm((current) => ({ ...current, branch: value }))}
            placeholder="Computer Science"
          />
          <ProfileField
            label="Year"
            value={form.year}
            onChange={(value) => setForm((current) => ({ ...current, year: value }))}
            placeholder="1-8"
            inputMode="numeric"
          />

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
              Bio
            </span>
            <textarea
              value={form.bio}
              onChange={(event) =>
                setForm((current) => ({ ...current, bio: event.target.value }))
              }
              rows={5}
              placeholder="What do you write about?"
              className="w-full resize-none rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm leading-relaxed text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          {message ? <p className="text-sm text-success">{message}</p> : null}
          {error ? <p className="text-sm text-error">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </button>
        </form>

        <div>
          <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-text-tertiary">
                Your desk
              </p>
              <h2 className="font-heading text-2xl font-semibold text-text">
                Published articles
              </h2>
            </div>
            <Link
              href={ROUTES.write}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface"
            >
              <PenSquare className="h-4 w-4" />
              Write
            </Link>
          </div>

          {publishedArticles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {publishedArticles.map((article) => (
                <ArticleCard key={article.slug} {...article} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-bg-elevated px-8 py-14 text-center">
              <h3 className="font-heading text-2xl font-semibold text-text">
                No published articles yet
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
                Publish your first essay, report, or campus note and it will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ProfileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-heading text-2xl font-semibold text-text">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-text-tertiary">
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
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}
