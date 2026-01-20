'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { Lock } from 'lucide-react'

export default function AccessDeniedPage() {
  const router = useRouter()
  const { lang, t } = useLocale()
  const { user } = useAuth()

  const handleGoBack = () => {
    if (user?.role === 'florist' || user?.role === 'sales') {
      router.push(`/${lang}/tasks`)
    } else {
      router.push(`/${lang}/dashboard`)
    }
  }

  const destinationLabel = user?.role === 'florist' || user?.role === 'sales' ? t('nav.tasks') : t('nav.dashboard')

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-orange-100 rounded-full p-4">
            <Lock className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{t('accessDenied.title')}</h1>
          <p className="text-muted-foreground">
            {t('accessDenied.message')}
          </p>
        </div>

        <button
          onClick={handleGoBack}
          className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          {`${t('accessDenied.goBack')} ${destinationLabel}`}
        </button>
      </div>
    </div>
  )
}
