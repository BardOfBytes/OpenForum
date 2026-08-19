import { PageSkeleton, Skeleton, ArticleGridSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="mb-14 flex flex-col items-center gap-4 text-center">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="mb-10 flex justify-center gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>
      <ArticleGridSkeleton count={6} />
    </PageSkeleton>
  );
}
