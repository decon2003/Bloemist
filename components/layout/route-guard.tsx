'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { canAccessRoute } from '@/lib/route-protection'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading, isAuthenticated } = useAuth()
  const { lang } = useLocale()

  const isPublicRoute = pathname.includes('/login') || pathname.includes('/access-denied')

  useEffect(() => {
    if (isLoading || isPublicRoute) return

    if (!isAuthenticated) {
      router.push(`/${lang}/login`)
      return
    }

    if ((user?.role === 'florist' || user?.role === 'sales') && pathname.includes('/dashboard')) {
      router.replace(`/${lang}/checkins`)
      return
    }

    if (!canAccessRoute(pathname, user?.role ?? null)) {
      router.push(`/${lang}/access-denied`)
      return
    }
  }, [isAuthenticated, isLoading, pathname, user?.role, router, lang, isPublicRoute])

  if (isPublicRoute) {
    return children
  }

  if (isLoading || !isAuthenticated) {
    return null
  }

  return children
}
