'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { defaultLocale, isSupportedLocale, type SupportedLocale } from '@/lib/i18n'
import type { Order, TaskStatus } from '@/lib/types'

// The app is in Vietnamese only and its texts are written where they are
// shown. This keeps the "/vi" segment of the URLs and the labels of the
// status and delivery codes.

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  UNASSIGNED: 'Chưa phân công',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang làm',
  READY: 'Sẵn sàng',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã huỷ',
}

const ORDER_STATUS_LABEL: Record<Order['status'], string> = {
  NEW: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  READY: 'Sẵn sàng',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
}

const DELIVERY_LABEL: Record<'DELIVERY' | 'PICKUP', string> = {
  DELIVERY: 'Giao tận nơi',
  PICKUP: 'Nhận tại shop',
}

const LocaleContext = createContext<SupportedLocale | null>(null)

export function LocaleProvider({ lang, children }: { lang: string; children: ReactNode }) {
  return <LocaleContext.Provider value={isSupportedLocale(lang) ? lang : defaultLocale}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const lang = useContext(LocaleContext)
  if (!lang) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return {
    lang,
    getTaskStatusLabel: (status: TaskStatus) => TASK_STATUS_LABEL[status] ?? status,
    getOrderStatusLabel: (status: Order['status']) => ORDER_STATUS_LABEL[status] ?? status,
    getDeliveryLabel: (type: 'DELIVERY' | 'PICKUP') => DELIVERY_LABEL[type] ?? type,
  }
}
