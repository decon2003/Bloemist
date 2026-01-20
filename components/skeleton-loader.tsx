export function KpiCardSkeleton() {
  return (
    <div className="min-w-max rounded-xl border border-border bg-white p-4 md:min-w-fit md:p-6 animate-pulse">
      <div className="mb-3 h-10 w-10 rounded-lg bg-muted" />
      <div className="h-3 w-20 bg-muted rounded" />
      <div className="mt-2 h-8 w-24 bg-muted rounded" />
      <div className="mt-2 h-3 w-16 bg-muted rounded" />
    </div>
  )
}

export function StatsCardSkeleton() {
  return (
    <div className="flex-shrink-0 snap-center rounded-xl border border-border bg-white p-4 md:flex-shrink animate-pulse">
      <div className="h-3 w-16 bg-muted rounded" />
      <div className="mt-2 h-8 w-12 bg-muted rounded" />
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-border">
      <td className="px-6 py-4">
        <div className="flex gap-3 items-center">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </td>
      <td className="px-6 py-4"><div className="h-4 w-8 bg-muted rounded mx-auto" /></td>
      <td className="px-6 py-4"><div className="h-4 w-8 bg-muted rounded mx-auto" /></td>
      <td className="px-6 py-4"><div className="h-4 w-8 bg-muted rounded mx-auto" /></td>
      <td className="px-6 py-4"><div className="h-4 w-8 bg-muted rounded mx-auto" /></td>
      <td className="px-6 py-4"><div className="h-6 w-20 bg-muted rounded-full mx-auto" /></td>
    </tr>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-border p-4 animate-pulse bg-white">
      <div className="flex gap-3 mb-3">
        <div className="h-16 w-16 rounded-lg bg-muted" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-muted rounded mb-2" />
          <div className="h-6 w-20 bg-muted rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-3 w-12 bg-muted rounded" />
        <div className="h-3 w-12 bg-muted rounded" />
      </div>
    </div>
  )
}

export function TaskCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 md:flex-row md:items-center md:justify-between animate-pulse">
      <div className="flex flex-1 items-start gap-3">
        <div className="h-5 w-5 rounded-full bg-muted" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-muted rounded mb-2" />
          <div className="h-3 w-48 bg-muted rounded mb-2" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-16 bg-muted rounded-full" />
            <div className="h-6 w-20 bg-muted rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-20 bg-muted rounded-lg" />
        <div className="h-9 w-9 bg-muted rounded-lg" />
      </div>
    </div>
  )
}

export function ErrorState({ message = "Failed to load data. Please try again." }: { message?: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <div className="mb-3 flex justify-center">
        <div className="rounded-full bg-red-100 p-3">
          <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 0v2m0-2v-2m0 0H9m3 0h3" />
          </svg>
        </div>
      </div>
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}
