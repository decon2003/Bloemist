'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { defaultLocale, getDictionary, isSupportedLocale, SupportedLocale } from '@/lib/i18n'
import { Order, TaskStatus } from '@/lib/types'

interface LocaleContextValue {
  lang: SupportedLocale
  dictionary: Record<string, string>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ lang, children }: { lang: string; children: ReactNode }) {
  const normalizedLang = isSupportedLocale(lang) ? lang : defaultLocale
  const value = useMemo<LocaleContextValue>(
    () => ({
      lang: normalizedLang,
      dictionary: getDictionary(normalizedLang),
    }),
    [normalizedLang],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

type OrderStatus = Order['status']

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }

  const t = useCallback(
    (key: string, fallback?: string) => {
      return context.dictionary[key] ?? fallback ?? key
    },
    [context.dictionary],
  )

  const getTaskStatusLabel = useCallback(
    (status: TaskStatus) => t(`status.task.${status}`, status.replace('_', ' ')),
    [t],
  )

  const getOrderStatusLabel = useCallback(
    (status: OrderStatus) => t(`status.order.${status}`, status.replace('_', ' ')),
    [t],
  )

  const getDeliveryLabel = useCallback(
    (type: 'DELIVERY' | 'PICKUP') => t(`delivery.${type}`, type === 'DELIVERY' ? 'Delivery' : 'Pickup'),
    [t],
  )

  return {
    lang: context.lang,
    t,
    getTaskStatusLabel,
    getOrderStatusLabel,
    getDeliveryLabel,
  }
}
