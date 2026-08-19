import { PageSkeleton, Skeleton, ArticleGridSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="mx-auto max-w-3xl">
        <Skeleton className="mb-6 h-3 w-32" />
        <Skeleton className="mb-4 h-10 w-full" />
        <Skeleton className="mb-8 h-10 w-3/4" />
        <div className="mb-10 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="mb-10 aspect-[16/9] w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={i % 4 === 3 ? "h-4 w-2/3" : "h-4 w-full"} />
          ))}
        </div>
      </div>
      <div className="mt-20">
        <Skeleton className="mb-8 h-6 w-48" />
        <ArticleGridSkeleton count={3} />
      </div>
    </PageSkeleton>
  );
}
