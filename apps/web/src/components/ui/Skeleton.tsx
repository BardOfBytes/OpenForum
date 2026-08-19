/**
 * Skeleton — shared loading placeholders.
 *
 * These back the route-level `loading.tsx` files. In the App Router a
 * navigation to a dynamic route renders nothing until the server render
 * finishes; without a loading boundary the browser sits on the previous page
 * with no indication that anything is happening. A loading file also gives
 * Next a shell it can prefetch, so hovering a link is no longer wasted.
 *
 * Purely presentational and server-rendered — no "use client" needed.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-foreground/10 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Placeholder matching the article card grid used across the site. */
export function ArticleCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[16/10] w-full rounded-xl" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

/** A responsive grid of article card placeholders. */
export function ArticleGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <ArticleCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Full-page loading shell.
 *
 * `sr-only` live text announces the state to screen readers, which otherwise
 * get no signal that a navigation is in flight.
 */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-16 md:px-8">
      <p className="sr-only" role="status" aria-live="polite">
        Loading…
      </p>
      {children}
    </main>
  );
}
