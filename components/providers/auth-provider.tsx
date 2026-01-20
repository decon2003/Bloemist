'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react'
import { User, AuthContextValue } from '@/lib/types'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Mock users database
const mockUsers: Record<string, { password: string; user: User }> = {
  'admin@bloemist.com': {
    password: 'admin',
    user: {
      id: 'user-1',
      name: 'Admin User',
      email: 'admin@bloemist.com',
      phone: '+1 555-0001',
      role: 'boss',
      status: 'active',
      avatar: '👩‍💼',
      createdAt: new Date().toISOString(),
    },
  },
  'florist@bloemist.com': {
    password: 'florist',
    user: {
      id: 'user-2',
      name: 'Sarah Chen',
      email: 'florist@bloemist.com',
      phone: '+1 555-0002',
      role: 'florist',
      status: 'active',
      avatar: '👩‍🌾',
      createdAt: new Date().toISOString(),
    },
  },
  'sales@bloemist.com': {
    password: 'sales',
    user: {
      id: 'user-4',
      name: 'Nina Patel',
      email: 'sales@bloemist.com',
      phone: '+1 555-0004',
      role: 'sales',
      status: 'active',
      avatar: '📞',
      createdAt: new Date().toISOString(),
    },
  },
  'tech@bloemist.com': {
    password: 'admin',
    user: {
      id: 'user-3',
      name: 'Tech Admin',
      email: 'tech@bloemist.com',
      phone: '+1 555-0003',
      role: 'admin',
      status: 'active',
      avatar: '👨‍💻',
      createdAt: new Date().toISOString(),
    },
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Failed to parse saved user:', error)
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { login: apiLogin } = await import('@/lib/api')
      const userData = await apiLogin(email, password)

      setUser(userData)
      localStorage.setItem('auth_user', JSON.stringify(userData))
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('auth_user')
  }, [])

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem('auth_user', JSON.stringify(updatedUser))
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
