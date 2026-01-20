import type { ReactNode } from 'react'
import AppShell from '@/components/layout/app-shell'
import { RouteGuard } from '@/components/layout/route-guard'
import { LocaleProvider } from '@/components/providers/locale-provider'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ViewSettingsProvider } from '@/components/providers/view-settings-provider'

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <AuthProvider>
      <LocaleProvider lang={lang}>
        <ViewSettingsProvider>
          <AppShell>
            <RouteGuard>{children}</RouteGuard>
          </AppShell>
        </ViewSettingsProvider>
      </LocaleProvider>
    </AuthProvider>
  )
}
