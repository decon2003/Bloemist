/** The user object the client keeps in memory after login / on /api/auth/me.
 *  Never includes salary, password hash or lockout fields. */
export const toSessionResponse = (user: {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: string
  avatar: string | null
  createdAt: Date
  mustChangePassword: boolean
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  avatar: user.avatar,
  createdAt: user.createdAt.toISOString(),
  mustChangePassword: user.mustChangePassword,
})
