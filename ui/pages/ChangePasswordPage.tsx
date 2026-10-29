'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { changePassword } from '@/lib/api'

const MIN_LENGTH = 8

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50'

export default function ChangePasswordPage() {
  const { lang, t } = useLocale()
  const { user, updateUser, logout } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const forced = !!user?.mustChangePassword
  const homePath = user?.role === 'admin' ? 'dashboard' : 'orders'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < MIN_LENGTH) {
      setError(t('auth.newPassword', 'Mật khẩu mới (ít nhất 8 ký tự)'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Hai mật khẩu mới không khớp'))
      return
    }

    setIsSaving(true)
    try {
      const updated = await changePassword(currentPassword, newPassword)
      updateUser(updated)
      window.location.assign(`/${lang}/${homePath}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed', 'Đã có lỗi xảy ra'))
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 space-y-6">
        <div className="flex justify-center">
          <Image src="/logo.jpg" alt="Bloemist" width={64} height={64} className="rounded-lg" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{t('auth.changePassword', 'Đổi mật khẩu')}</h1>
          <p className="text-sm text-muted-foreground">
            {forced
              ? t('auth.changePasswordForced', 'Bạn đang dùng mật khẩu tạm do quản lý cấp. Vui lòng đặt mật khẩu mới để tiếp tục.')
              : user?.email}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lets password managers attach the new password to the right account. */}
          <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-foreground mb-2">
              {t('auth.currentPassword', 'Mật khẩu hiện tại')}
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSaving}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-2">
              {t('auth.newPassword', 'Mật khẩu mới (ít nhất 8 ký tự)')}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSaving}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-2">
              {t('auth.confirmPassword', 'Nhập lại mật khẩu mới')}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSaving}
              className={inputClass}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '...' : t('auth.savePassword', 'Lưu mật khẩu mới')}
          </button>
        </form>

        <div className="text-center">
          {forced ? (
            <button
              type="button"
              onClick={async () => {
                await logout().catch(() => undefined)
                window.location.assign(`/${lang}/login`)
              }}
              className="text-sm text-muted-foreground hover:underline"
            >
              {t('auth.signOut', 'Đăng xuất')}
            </button>
          ) : (
            <a href={`/${lang}/${homePath}`} className="text-sm text-primary hover:underline">
              ←
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
