import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { supportedLocales, type SupportedLocale } from '@/lib/i18n'
import AppShell from '@/components/layout/app-shell'
import { RouteGuard } from '@/components/layout/route-guard'
import { LocaleProvider } from '@/components/providers/locale-provider'
import { ViewSettingsProvider } from '@/components/providers/view-settings-provider'
import { AppDataProvider } from '@/components/providers/app-data-provider'

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!supportedLocales.includes(lang as SupportedLocale)) notFound()

  return (
    <LocaleProvider lang={lang}>
      <ViewSettingsProvider>
        <AppDataProvider>
          <AppShell>
            <RouteGuard>{children}</RouteGuard>
          </AppShell>
        </AppDataProvider>
      </ViewSettingsProvider>
    </LocaleProvider>
  )
}
