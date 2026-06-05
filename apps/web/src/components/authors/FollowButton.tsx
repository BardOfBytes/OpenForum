"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import { apiUrl } from "@/lib/api/base-url";
import { ROUTES } from "@/lib/routes";

interface FollowButtonProps {
  authorId: string;
  sessionToken: string | null;
  initialFollowing?: boolean;
  initialFollowerCount?: number;
}

export function FollowButton({
  authorId,
  sessionToken,
  initialFollowing = false,
  initialFollowerCount = 0,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sessionToken) {
    return (
      <Link
        href={`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.author.detail(authorId))}`}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-5 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface"
      >
        <UserPlus className="h-4 w-4" />
        Sign in to follow
      </Link>
    );
  }

  async function toggleFollow() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/v1/users/${authorId}/follow`), {
        method: following ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!response.ok) {
        throw new Error(`Follow action failed (${response.status})`);
      }

      const body = (await response.json().catch(() => null)) as {
        active?: boolean;
        count?: number;
      } | null;

      if (typeof body?.active === "boolean") {
        setFollowing(body.active);
      } else {
        setFollowing((current) => !current);
      }

      if (typeof body?.count === "number") {
        setFollowerCount(body.count);
      }
    } catch {
      setError("Could not update follow state.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={toggleFollow}
        disabled={pending}
        className={[
          "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-70",
          following
            ? "border border-border bg-bg text-text hover:bg-surface"
            : "bg-accent text-text-inverse hover:bg-accent-hover",
        ].join(" ")}
        aria-pressed={following}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {following ? "Following" : "Follow author"}
      </button>
      <p className="text-xs text-text-tertiary">
        {followerCount} {followerCount === 1 ? "follower" : "followers"}
      </p>
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </div>
  );
}
