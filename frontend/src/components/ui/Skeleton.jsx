export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} aria-hidden="true" />
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl p-4 border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
      </div>
    </div>
  )
}

export function StatCardSkeletonRow({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function BorrowingRowSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex gap-4">
      <Skeleton className="w-12 h-16 rounded-md shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 max-w-[200px]" />
        <Skeleton className="h-3 w-1/2 max-w-[140px]" />
        <Skeleton className="h-3 w-2/3 max-w-[180px]" />
      </div>
    </div>
  )
}

export function AdminTabSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <BorrowingRowSkeleton key={i} />
      ))}
    </div>
  )
}
