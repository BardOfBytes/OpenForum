"use client";

interface AuthorBadgeProps {
  name: string;
  avatarUrl?: string | null;
  avatarFallback: string;
  date?: string;
  readTime?: string;
}

export function AuthorBadge({
  name,
  avatarUrl,
  avatarFallback,
  date,
  readTime,
}: AuthorBadgeProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-8 w-8 flex-shrink-0 rounded-full border border-border object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground">
          {avatarFallback}
        </div>
      )}
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-foreground">{name}</p>
        {(date || readTime) && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {date}
            {date && readTime ? " · " : ""}
            {readTime}
          </p>
        )}
      </div>
    </div>
  );
}
