'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react'
import { User, AuthContextValue } from '@/lib/types'
import { fetchCurrentUser, login as apiLogin, logout as apiLogout } from '@/lib/api'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // The session lives in an httpOnly cookie; ask the server who we are rather
  // than trusting anything stored in the browser.
  useEffect(() => {
    // Older builds kept the whole user object here and treated it as a login.
    try {
      localStorage.removeItem('auth_user')
    } catch {
      // storage unavailable - nothing to clean up
    }

    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))

    const onUnauthorized = () => setUser(null)
    const onPasswordChangeRequired = () =>
      setUser((current) => (current ? { ...current, mustChangePassword: true } : current))

    window.addEventListener('auth:unauthorized', onUnauthorized)
    window.addEventListener('auth:password-change-required', onPasswordChangeRequired)
    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized)
      window.removeEventListener('auth:password-change-required', onPasswordChangeRequired)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const userData = await apiLogin(email, password)
      setUser(userData)
      return userData
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setUser(null)
    }
  }, [])

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      updateUser,
    }),
    [user, isLoading, login, logout, updateUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
