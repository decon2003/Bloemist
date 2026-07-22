'use client'

import { useEffect } from 'react'

/** Without an error boundary any throw during render - most often an Invalid
 *  Date reaching Intl.DateTimeFormat - unmounted the entire app and left a blank
 *  white page with no way back. */
export default function LocalisedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold text-foreground">Đã xảy ra lỗi</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Trang này không tải được. Bạn có thể thử lại — nếu lỗi lặp lại, hãy tải lại trình duyệt.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Thử lại
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Tải lại trang
        </button>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Mã lỗi: {error.digest}</p>
      ) : null}
    </div>
  )
}
