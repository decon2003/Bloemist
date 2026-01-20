'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { defaultLocale } from '@/lib/i18n'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        const destination = user && (user.role === 'sales' || user.role === 'florist') ? `/${defaultLocale}/checkins` : `/${defaultLocale}/dashboard`
        router.replace(destination)
      } else {
        router.replace(`/${defaultLocale}/login`)
      }
    }
  }, [isAuthenticated, isLoading, router, user?.role])

  return null
}
