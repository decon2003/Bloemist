import { User } from './types'

export type ProtectedRoute = {
  path: string
  allowedRoles: User['role'][]
}

export const protectedRoutes: ProtectedRoute[] = [
  // Settings are viewable by all roles; edits are limited in the UI to bosses/admins
  { path: '/settings', allowedRoles: ['boss', 'admin', 'sales', 'florist'] },
  { path: '/customers', allowedRoles: ['boss', 'admin'] },

  // Inventory is now visible to frontline staff
  { path: '/inventory', allowedRoles: ['boss', 'sales', 'florist', 'admin'] },

  // Orders, tasks, and check-ins - shared workspace tools
  { path: '/orders', allowedRoles: ['boss', 'sales', 'florist', 'admin'] },
  { path: '/tasks', allowedRoles: ['boss', 'sales', 'florist', 'admin'] },
  { path: '/checkins', allowedRoles: ['boss', 'sales', 'florist', 'admin'] },

  // Dashboard - bosses and admins only
  { path: '/dashboard', allowedRoles: ['boss', 'admin'] },

  // Staff performance reporting - bosses and admins only
  { path: '/staff', allowedRoles: ['boss', 'admin'] },
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
