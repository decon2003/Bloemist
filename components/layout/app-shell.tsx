'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Menu,
  X,
  Leaf,
  ShoppingBag,
  ClipboardList,
  Package,
  Users,
  Settings,
  LogOut,
  User,
  Briefcase,
  Award,
  Zap,
  MapPin,
  UserCheck,
} from 'lucide-react'
import { supportedLocales, localeNames } from '@/lib/i18n'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { lang, t } = useLocale()
  const { user, logout, isAuthenticated } = useAuth()

  const isPublicRoute = pathname?.includes('/login') || pathname?.includes('/access-denied')

  const navItems = useMemo(() => {
    const staffNav = [
      { href: `/${lang}/orders`, label: t('nav.orders'), icon: ShoppingBag },
      { href: `/${lang}/checkins`, label: t('nav.checkins'), icon: MapPin },
      { href: `/${lang}/inventory`, label: t('nav.inventory'), icon: Package },
    ]

    if (user?.role === 'sales' || user?.role === 'florist') {
      return staffNav
    }

    const managerBase = [
      { href: `/${lang}/dashboard`, label: t('nav.dashboard'), icon: Leaf },
      { href: `/${lang}/orders`, label: t('nav.orders'), icon: ShoppingBag },
      { href: `/${lang}/checkins`, label: t('nav.checkins'), icon: MapPin },
      { href: `/${lang}/staff`, label: t('nav.staffReports'), icon: UserCheck },
      { href: `/${lang}/settings`, label: t('nav.settings'), icon: Settings },
    ]

    if (user?.role === 'boss' || user?.role === 'admin') {
      return [
        ...managerBase,
        { href: `/${lang}/inventory`, label: t('nav.inventory'), icon: Package },
        { href: `/${lang}/customers`, label: t('nav.customers'), icon: Users },
      ]
    }

    return managerBase
  }, [lang, t, user?.role])

  const restPath = useMemo(() => {
    if (!pathname) return ''
    const segments = pathname.split('/').filter(Boolean)
    const [, ...rest] = segments
    return rest.join('/')
  }, [pathname])

  const handleLangChange = (nextLang: string) => {
    const fallback = '/dashboard'
    const destination = `/${nextLang}${restPath ? `/${restPath}` : fallback}`
    router.push(destination)
    setNavOpen(false)
  }

  const handleLogout = () => {
    logout()
    router.push(`/${lang}/login`)
    setUserMenuOpen(false)
  }

  if (isPublicRoute) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return null
  }

  const getRoleBadge = () => {
    switch (user?.role) {
      case 'boss':
        return { label: t('role.boss'), color: 'bg-amber-100 text-amber-800', icon: Briefcase }
      case 'admin':
        return { label: t('role.admin'), color: 'bg-violet-100 text-violet-800', icon: Award }
      case 'sales':
        return { label: t('role.sales'), color: 'bg-blue-100 text-blue-800', icon: Zap }
      case 'florist':
        return { label: t('role.florist'), color: 'bg-green-100 text-green-800', icon: Zap }
      default:
        return { label: t('role.user'), color: 'bg-gray-100 text-gray-800', icon: User }
    }
  }

  const roleBadge = getRoleBadge()

  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-border bg-white px-4 py-4 md:hidden">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.jpg"
              alt="Bloemist"
              width={32}
              height={32}
              className="rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="rounded-full w-10 h-10 bg-muted flex items-center justify-center hover:bg-muted/80 relative"
            >
              {user?.avatar || '👤'}
            </button>
            <button
              onClick={() => setNavOpen((prev) => !prev)}
              className="rounded-lg p-2 hover:bg-muted"
              aria-label="Toggle navigation"
            >
              {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {userMenuOpen && (
            <div className="absolute top-16 right-4 bg-white rounded-lg shadow-lg border border-border z-50 w-48">
              <div className="p-4 border-b border-border space-y-2">
                <p className="font-semibold text-foreground text-sm">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <div className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${roleBadge.color}`}>
                  {roleBadge.label}
                </div>
              </div>
              <button
                onClick={() => setUserMenuOpen(false)}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                {t('auth.profile')}
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                {t('auth.signOut')}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside
          className={`${navOpen ? 'block' : 'hidden'
            } border-b border-border bg-white md:sticky md:top-0 md:block md:h-screen md:w-64 md:flex-none md:border-b-0 md:border-r`}
        >
          <div className="flex flex-col px-4 py-6 h-full md:h-screen">
            <div className="hidden items-center gap-2 md:flex">
              <Image
                src="/logo.jpg"
                alt="Bloemist"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <span className="text-lg font-semibold text-primary">Bloemist CRM</span>
            </div>
            <nav className="mt-6 flex flex-col gap-2 flex-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname?.startsWith(href) ?? false
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setNavOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted'
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div className="space-y-4 border-t border-border pt-4">
              <div className="hidden md:block">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                    {user?.avatar || '👤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <div className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${roleBadge.color} mb-3`}>
                  {roleBadge.label}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  {t('auth.signOut')}
                </button>
              </div>


            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto bg-muted/40 relative">
          <div className="min-h-screen pb-20 md:pb-0">{children}</div>
        </div>
      </div>
    </main>
  )
}
