export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#222] ${className}`}
      style={{ minHeight: "1rem" }}
    />
  );
}

export function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return <Skeleton className={`h-4 ${width}`} />;
}

export function SkeletonCard() {
  return (
    <div className="border border-[#333333] bg-black p-4 space-y-3">
      <SkeletonLine width="w-3/4" />
      <SkeletonLine width="w-1/2" />
      <SkeletonLine width="w-5/6" />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border border-[#333333] bg-black p-3">
          <Skeleton className="size-4 shrink-0" />
          <SkeletonLine width={i % 2 === 0 ? "w-2/3" : "w-1/2"} />
        </div>
      ))}
    </div>
  );
}
