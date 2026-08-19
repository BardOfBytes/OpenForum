import { PageSkeleton, Skeleton, ArticleGridSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="mb-14 flex flex-col items-center gap-4 text-center">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
        <div className="flex gap-8 pt-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-20" />
          ))}
        </div>
      </div>
      <ArticleGridSkeleton count={6} />
    </PageSkeleton>
  );
}
