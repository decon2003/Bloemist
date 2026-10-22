'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type QueryKey = readonly unknown[]

type QueryState<T> = {
  data?: T
  status: 'pending' | 'success' | 'error'
  error: Error | null
}

type QueryOptions<T> = {
  queryKey: QueryKey
  queryFn: () => Promise<T>
  enabled?: boolean
  /** Keep showing the previous key's data while a new key loads (no flash
   *  when a list grows with "Xem thêm"). */
  keepPreviousData?: boolean
}

type MutationOptions<TData, TVariables> = {
  mutationFn: (variables: TVariables) => Promise<TData>
  onSuccess?: (data: TData, variables: TVariables, client: QueryClient) => void
  onError?: (error: unknown, variables: TVariables, client: QueryClient) => void
  onSettled?: (data: TData | undefined, error: unknown, variables: TVariables, client: QueryClient) => void
}

const hashKey = (key: QueryKey) => JSON.stringify(key)

class QueryClient {
  private cache = new Map<string, unknown>()
  private listeners = new Map<string, Set<() => void>>()

  getQueryData<T>(key: QueryKey): T | undefined {
    return this.cache.get(hashKey(key)) as T | undefined
  }

  setQueryData<T>(key: QueryKey, value: T | ((current?: T) => T)) {
    const hashed = hashKey(key)
    const current = this.cache.get(hashed) as T | undefined
    const nextValue = typeof value === 'function' ? (value as (current?: T) => T)(current) : value
    this.cache.set(hashed, nextValue)
    this.notify(hashed)
    return nextValue
  }

  invalidateQueries(key: QueryKey) {
    const hashed = hashKey(key)
    this.cache.delete(hashed)
    this.notify(hashed)
  }

  /** Cached keys that start with `prefix`, e.g. ['tasks'] matches ['tasks', { from, to }]. */
  private keysWithPrefix(prefix: QueryKey) {
    const head = hashKey(prefix).slice(0, -1) // drop the closing "]"
    return [...this.cache.keys()].filter((hashed) => hashed === `${head}]` || hashed.startsWith(`${head},`))
  }

  /** Apply an update to every cached list under `prefix` (each filter/scope). */
  setQueriesData<T>(prefix: QueryKey, update: (current: T) => T) {
    for (const hashed of this.keysWithPrefix(prefix)) {
      this.cache.set(hashed, update(this.cache.get(hashed) as T))
      this.notify(hashed)
    }
  }

  /** Drop every cached list under `prefix`; mounted queries refetch their own key. */
  removeQueries(prefix: QueryKey) {
    for (const hashed of this.keysWithPrefix(prefix)) {
      this.cache.delete(hashed)
      this.notify(hashed)
    }
  }

  subscribe(key: QueryKey, listener: () => void) {
    const hashed = hashKey(key)
    const listeners = this.listeners.get(hashed) ?? new Set()
    listeners.add(listener)
    this.listeners.set(hashed, listeners)

    return () => {
      const current = this.listeners.get(hashed)
      current?.delete(listener)
      if (current && current.size === 0) {
        this.listeners.delete(hashed)
      }
    }
  }

  private notify(hashed: string) {
    this.listeners.get(hashed)?.forEach((listener) => listener())
  }
}

const QueryClientContext = createContext<QueryClient | null>(null)

const QueryClientProvider = ({ client, children }: { client: QueryClient; children: ReactNode }) => (
  <QueryClientContext.Provider value={client}>{children}</QueryClientContext.Provider>
)

const useQueryClient = () => {
  const client = useContext(QueryClientContext)
  if (!client) {
    throw new Error('useQueryClient must be used within a QueryClientProvider')
  }
  return client
}

function useQuery<T>({ queryKey, queryFn, enabled = true, keepPreviousData = false }: QueryOptions<T>) {
  const client = useQueryClient()
  const keyHash = useMemo(() => hashKey(queryKey), [queryKey])

  const [state, setState] = useState<QueryState<T>>(() => {
    const cached = client.getQueryData<T>(queryKey)
    return {
      data: cached,
      status: !enabled || cached !== undefined ? 'success' : 'pending',
      error: null,
    }
  })

  // Use refs to avoid stale closures
  const queryFnRef = useRef(queryFn)
  const isFetchingRef = useRef(false)
  // The key last loaded. Tracking the key (not a boolean) means a changed
  // filter - e.g. another date - fetches again instead of keeping old data.
  const fetchedKeyRef = useRef<string | null>(null)
  const currentKeyRef = useRef(keyHash)
  queryFnRef.current = queryFn
  currentKeyRef.current = keyHash

  // Stable runQuery that won't change
  const runQuery = useCallback(async () => {
    if (!enabled) return
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    const requestedKey = keyHash
    setState((current) => ({ ...current, status: 'pending', error: null }))
    try {
      const data = await queryFnRef.current()
      client.setQueryData(queryKey, data)
      // The filter changed while this was in flight: keep it cached, don't show it.
      if (currentKeyRef.current === requestedKey) setState({ data, status: 'success', error: null })
      return data
    } catch (error) {
      console.error('Query error for', queryKey, error)
      if (currentKeyRef.current === requestedKey) {
        setState((current) => ({ ...current, status: 'error', error: error as Error }))
      }
    } finally {
      isFetchingRef.current = false
    }
  }, [client, enabled, keyHash])

  // Fetch once per key: on mount and whenever the key (filter) changes.
  useEffect(() => {
    if (!enabled) return
    if (fetchedKeyRef.current === keyHash) return
    fetchedKeyRef.current = keyHash

    const cached = client.getQueryData<T>(queryKey)
    if (cached !== undefined) {
      setState({ data: cached, status: 'success', error: null })
    } else {
      // A new key may still be in flight from the previous one; allow this fetch.
      isFetchingRef.current = false
      setState((current) => ({ data: keepPreviousData ? current.data : undefined, status: 'pending', error: null }))
      runQuery()
    }
  }, [enabled, keyHash])

  // Subscribe to cache updates. A removed entry (removeQueries) is refetched.
  useEffect(() => {
    return client.subscribe(queryKey, () => {
      const cached = client.getQueryData<T>(queryKey)
      if (cached !== undefined) {
        setState((current) => ({ ...current, data: cached, status: 'success' }))
      } else if (enabled) {
        runQuery()
      }
    })
  }, [client, keyHash, enabled])

  return {
    data: state.data,
    isPending: state.status === 'pending',
    error: state.error,
    refetch: runQuery,
  }
}

function useMutation<TData, TVariables>(options: MutationOptions<TData, TVariables>) {
  const client = useQueryClient()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const mutateAsync = useCallback(
    async (variables: TVariables) => {
      setIsPending(true)
      setError(null)
      let data: TData | undefined
      let caughtError: unknown
      try {
        data = await options.mutationFn(variables)
        options.onSuccess?.(data, variables, client)
        return data
      } catch (mutationError) {
        caughtError = mutationError
        setError(mutationError)
        options.onError?.(mutationError, variables, client)
        throw mutationError
      } finally {
        setIsPending(false)
        options.onSettled?.(data, caughtError, variables, client)
      }
    },
    [client, options],
  )

  return { mutateAsync, isPending, error }
}

export { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient }
