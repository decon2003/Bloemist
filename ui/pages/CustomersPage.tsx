'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Sparkles } from 'lucide-react'
import { useAppData } from '@/components/providers/app-data-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { parseCurrencyToNumber, formatCurrencyFromNumber } from '@/lib/utils'

export default function CustomersPage() {
  const { orders } = useAppData()
  const { t } = useLocale()

  const customers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; total: number; orders: number }>()
    orders.forEach((order) => {
      const current = map.get(order.customerPhone)
      const spend = parseCurrencyToNumber(order.total)
      if (current) {
        current.total += spend
        current.orders += 1
      } else {
        map.set(order.customerPhone, {
          id: order.id,
          name: order.customerName,
          phone: order.customerPhone,
          total: spend,
          orders: 1,
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [orders])

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('customers.subtitle')}</p>
          <h1 className="text-3xl font-bold text-foreground">{t('customers.title')}</h1>
          <p className="text-muted-foreground">{t('customers.subtitleHelper', 'Top repeat purchasers and their most recent bouquets.')}</p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span>{t('customers.loyaltyTeaser', 'Customer loyalty program launches soon')}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => (
          <article key={customer.phone} className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Image
                src="/placeholder-user.jpg"
                width={48}
                height={48}
                alt={customer.name}
                className="h-12 w-12 rounded-xl object-cover"
              />
              <div>
                <h2 className="text-lg font-semibold text-foreground">{customer.name}</h2>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('customers.lifetimeSpend')}</dt>
                <dd className="text-2xl font-bold text-primary">
                  {formatCurrencyFromNumber(customer.total)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('customers.orders', 'Orders')}</dt>
                <dd className="text-2xl font-semibold text-foreground">{customer.orders}</dd>
              </div>
            </dl>
            <div className="mt-6 rounded-xl border border-dashed border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
              <p>{t('customers.recentBouquet', 'Recent bouquet:')}</p>
              <p className="font-medium text-foreground">{orders.find((order) => order.customerPhone === customer.phone)?.bouquetName}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
