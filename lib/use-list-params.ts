'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ListParams } from './types'

/** Turn a list page's filters into the server-side scope it should load.
 *  A search wins over dates (it covers all history); otherwise the selected
 *  day or range; with neither, an empty scope = the server's working window. */
export function useListParams({
  mode,
  selectedDate,
  range,
  query,
}: {
  mode: 'range' | 'carousel'
  selectedDate: string
  range: { from: string; to: string }
  query: string
}): ListParams {
  // Wait for typing to pause before searching the server.
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim())
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  return useMemo<ListParams>(() => {
    if (debouncedQuery) return { q: debouncedQuery }
    if (mode === 'range') {
      if (!range.from) return {}
      return range.to ? { from: range.from, to: range.to } : { from: range.from }
    }
    return selectedDate ? { from: selectedDate, to: selectedDate } : {}
  }, [debouncedQuery, mode, range.from, range.to, selectedDate])
}
