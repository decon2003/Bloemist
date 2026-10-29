import { User } from './types'

export type ProtectedRoute = {
  path: string
  allowedRoles: User['role'][]
}

export const protectedRoutes: ProtectedRoute[] = [
  // Settings are viewable by all roles; edits are limited in the UI to admins
  { path: '/settings', allowedRoles: ['admin', 'sales', 'florist'] },
  { path: '/customers', allowedRoles: ['admin'] },

  // Orders and check-ins - shared workspace tools
  { path: '/orders', allowedRoles: ['admin', 'sales', 'florist'] },
  { path: '/checkins', allowedRoles: ['admin', 'sales', 'florist'] },

  // Dashboard - admins only
  { path: '/dashboard', allowedRoles: ['admin'] },

  // Payroll - admins only
  { path: '/payroll', allowedRoles: ['admin'] },

  // Own pay - everyone sees only their own
  { path: '/my-pay', allowedRoles: ['admin', 'sales', 'florist'] },

  // Staff performance reporting - admins only
  { path: '/staff', allowedRoles: ['admin'] },
]

export function canAccessRoute(pathname: string, userRole: User['role'] | null): boolean {
  if (!userRole) return false

  // Allow login page for everyone
  if (pathname.includes('/login')) return true

  // Find matching protected route
  const route = protectedRoutes.find(r => pathname.includes(r.path))
  
  if (!route) return true // Allow unmarked routes
  
  return route.allowedRoles.includes(userRole)
}
