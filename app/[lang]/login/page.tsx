'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const { lang, t } = useLocale()
  const { login, isLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await login(email, password)
      router.push(`/${lang}/dashboard`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed', 'Login failed'))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-orange-50 flex items-center justify-center p-4">
      {/* Decorative flowers background */}
      <div className="absolute top-10 right-10 opacity-10">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="50" cy="50" r="30" fill="#d4a574" />
          <circle cx="20" cy="30" r="15" fill="#f4d5a0" />
          <circle cx="80" cy="40" r="12" fill="#e8b4a0" />
        </svg>
      </div>
      <div className="absolute bottom-10 left-10 opacity-10">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="50" r="25" fill="#a78bfa" />
          <circle cx="70" cy="80" r="18" fill="#d8b4fe" />
          <circle cx="130" cy="85" r="15" fill="#c4b5fd" />
        </svg>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <Image
              src="/logo.jpg"
              alt="Bloemist"
              width={64}
              height={64}
              className="rounded-lg"
            />
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{t('auth.loginTitle')}</h1>
            <p className="text-muted-foreground">{t('auth.loginSubtitle')}</p>
          </div>



          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email/Phone Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                {t('auth.emailLabel')}
              </label>
              <input
                id="email"
                type="text"
                placeholder="admin@bloemist.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                {t('auth.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.passwordLabel')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          {/* Forgot Password Link */}
          <div className="text-center">
            <Link
              href="#"
              className="text-sm text-primary hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
