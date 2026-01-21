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

function useQuery<T>({ queryKey, queryFn }: QueryOptions<T>) {
  const client = useQueryClient()
  const [state, setState] = useState<QueryState<T>>(() => ({
    data: client.getQueryData<T>(queryKey),
    status: client.getQueryData<T>(queryKey) ? 'success' : 'pending',
    error: null,
  }))

  const keyHash = useMemo(() => hashKey(queryKey), [queryKey])
  const queryFnRef = useRef(queryFn)
  const isFetchingRef = useRef(false)
  queryFnRef.current = queryFn

  const runQuery = useCallback(async () => {
    // Prevent duplicate fetches
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    setState((current) => ({ ...current, status: 'pending', error: null }))
    try {
      const data = await queryFnRef.current()
      client.setQueryData(queryKey, data)
      setState({ data, status: 'success', error: null })
      return data
    } catch (error) {
      setState((current) => ({ ...current, status: 'error', error: error as Error }))
      throw error
    } finally {
      isFetchingRef.current = false
    }
  }, [client, keyHash]) // Use keyHash instead of queryKey to prevent unnecessary re-runs

  // Initial fetch - only runs once per queryKey
  useEffect(() => {
    const cached = client.getQueryData<T>(queryKey)
    if (cached !== undefined) {
      setState({ data: cached, status: 'success', error: null })
    } else {
      runQuery().catch(() => null)
    }
  }, [keyHash]) // Only re-run when key changes

  // Subscribe to cache updates from other components
  useEffect(() => {
    const unsubscribe = client.subscribe(queryKey, () => {
      const cached = client.getQueryData<T>(queryKey)
      if (cached !== undefined) {
        setState((current) => ({ ...current, data: cached, status: 'success' }))
      }
    })
    return unsubscribe
  }, [client, keyHash])

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
