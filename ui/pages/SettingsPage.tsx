'use client'

import React, { useState, useEffect } from 'react'
import { Bell, Shield, Users, Plus, Edit2, Trash2, X, Clock } from 'lucide-react'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { useAppData } from '@/components/providers/app-data-provider'
import { User } from '@/lib/types'

const sections = [
  {
    id: 'notifications',
    icon: Bell,
    keyTitle: 'settings.notificationsTitle',
    keyCopy: 'settings.notificationsCopy',
    fallbackTitle: 'Notifications',
    fallbackCopy: 'Configure SMS and email alerts.',
    items: [
      'SMS alerts for urgent orders',
      'Daily digest with revenue snapshot',
      'Florist assignment notifications',
    ],
  },
  {
    id: 'roles',
    icon: Users,
    keyTitle: 'settings.rolesTitle',
    keyCopy: 'settings.rolesCopy',
    fallbackTitle: 'Team Roles',
    fallbackCopy: 'Manage florist and sales permissions.',
    items: [
      'Invite new florists to the workspace',
      'Grant manager access for reporting',
      'Review pending invitations',
    ],
  },
  {
    id: 'security',
    icon: Shield,
    fallbackTitle: 'Security',
    fallbackCopy: 'Protect sign-ins and audit changes.',
    items: [
      'Enable two-factor authentication',
      'Review connected devices',
      'Export audit log',
    ],
  },
]

interface UserFormData {
  name: string
  email: string
  phone: string
  role: User['role']
}

const UserFormModal = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  submitLabel,
  initialData,
  isSubmitting
}: {
  isOpen: boolean
  title: string
  onClose: () => void
  onSubmit: (data: UserFormData) => void
  submitLabel: string
  initialData?: UserFormData
  isSubmitting: boolean
}) => {
  // Modal manages its own state
  const [localData, setLocalData] = useState<UserFormData>({
    name: '',
    email: '',
    phone: '',
    role: 'sales'
  })

  // Reset or initialize state when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setLocalData(initialData)
      } else {
        setLocalData({ name: '', email: '', phone: '', role: 'sales' })
      }
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Họ và tên</label>
            <input
              type="text"
              value={localData.name}
              onChange={(e) => setLocalData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              type="email"
              value={localData.email}
              onChange={(e) => setLocalData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="email@bloemist.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Số điện thoại</label>
            <input
              type="tel"
              value={localData.phone}
              onChange={(e) => setLocalData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0901234567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Vai trò</label>
            <select
              value={localData.role}
              onChange={(e) => setLocalData(prev => ({ ...prev, role: e.target.value as User['role'] }))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="sales">Sales</option>
              <option value="florist">Florist</option>
              <option value="boss">Boss</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-foreground border border-border rounded-lg hover:bg-muted"
          >
            Hủy
          </button>
          <button
            onClick={() => onSubmit(localData)}
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Đang xử lý...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useLocale()
  const { user } = useAuth()
  const { users: appUsers, settings } = useAppData()

  const users = appUsers

  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [workingHours, setWorkingHours] = useState({ start: '08:00', end: '18:00' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  React.useEffect(() => {
    if (settings) {
      setWorkingHours(settings.workingHours)
    }
  }, [settings])

  const canManageUsers = user?.role === 'boss' || user?.role === 'admin'
  const canEditSettings = canManageUsers
  const workingHoursLabel =
    workingHours.start && workingHours.end
      ? `${workingHours.start} - ${workingHours.end}`
      : t('settings.workingHoursUnset', 'Not set')

  const handleAddUser = async (data: UserFormData) => {
    if (!canManageUsers) {
      alert('Bạn không có quyền thêm nhân viên')
      return
    }

    if (!data.name || !data.email || !data.phone || !data.role) {
      alert('Vui lòng điền đầy đủ thông tin: Họ tên, Email, Số điện thoại và Vai trò')
      return
    }

    setIsSubmitting(true)
    try {
      const { createUser } = await import('@/lib/api')
      await createUser({
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
      })
      alert('Thêm nhân viên thành công!')
      setShowAddUserModal(false)
      window.location.reload()
    } catch (error: any) {
      console.error('Add user error:', error)
      alert('Lỗi: ' + (error.message || 'Không thể thêm nhân viên'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClick = (u: User) => {
    setEditingUser(u)
    setShowEditUserModal(true)
  }

  const handleUpdateUser = async (data: UserFormData) => {
    if (!canManageUsers || !editingUser) return

    if (!data.name || !data.email || !data.phone || !data.role) {
      alert('Vui lòng điền đầy đủ thông tin')
      return
    }

    setIsSubmitting(true)
    try {
      const { updateUser } = await import('@/lib/api')
      await updateUser(editingUser.id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
      })
      alert('Cập nhật thành công!')
      setShowEditUserModal(false)
      setEditingUser(null)
      window.location.reload()
    } catch (error: any) {
      console.error('Update user error:', error)
      alert('Lỗi: ' + (error.message || 'Không thể cập nhật'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (u: User) => {
    if (!canManageUsers) return

    if (u.email === 'admin@bloemist.com') {
      alert('Không thể xóa tài khoản Admin chính')
      return
    }

    if (!confirm(`Bạn có chắc muốn xóa nhân viên "${u.name}"?`)) {
      return
    }

    try {
      const { deleteUser } = await import('@/lib/api')
      await deleteUser(u.id)
      alert('Đã xóa nhân viên')
      window.location.reload()
    } catch (error: any) {
      console.error('Delete user error:', error)
      alert('Lỗi: ' + (error.message || 'Không thể xóa'))
    }
  }

  const handleWorkingHoursChange = (field: 'start' | 'end', value: string) => {
    if (!canEditSettings) return
    setWorkingHours((prev) => ({ ...prev, [field]: value }))
  }

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'boss':
        return 'bg-amber-100 text-amber-800'
      case 'admin':
        return 'bg-violet-100 text-violet-800'
      case 'sales':
        return 'bg-blue-100 text-blue-800'
      case 'florist':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-12">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('settings.subtitle')}</p>
        <h1 className="text-3xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground">
          Quản lý thông báo, phân quyền và cài đặt không gian làm việc.
        </p>
        {!canEditSettings && (
          <div className="rounded-2xl border border-dashed border-muted bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('settings.viewingOnly')}
          </div>
        )}
      </div>

      {/* Working Hours Section */}
      <section className="space-y-6 rounded-3xl border border-border bg-white/90 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('settings.workingHoursTitle', 'Working hours')}
            </p>
            <h2 className="text-2xl font-semibold text-foreground">
              {t('settings.workingHoursDescription', 'Set the expected start and end time for check-ins')}
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" /> {workingHoursLabel}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Giờ bắt đầu
            </label>
            <input
              type="time"
              value={workingHours.start}
              onChange={(e) => handleWorkingHoursChange('start', e.target.value)}
              disabled={!canEditSettings}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Giờ kết thúc
            </label>
            <input
              type="time"
              value={workingHours.end}
              onChange={(e) => handleWorkingHoursChange('end', e.target.value)}
              disabled={!canEditSettings}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </section>

      {/* Settings Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.id} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <section.icon className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {section.keyTitle ? t(section.keyTitle) : section.fallbackTitle}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {section.keyCopy ? t(section.keyCopy) : section.fallbackCopy}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-foreground">
              {section.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <button
              disabled={!canEditSettings}
              className="mt-5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Quản lý
            </button>
          </section>
        ))}
      </div>

      {/* User Management Section */}
      {canManageUsers && (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Quản lý nhân sự</h2>
                <p className="text-sm text-muted-foreground">Thêm, sửa và quản lý thành viên nhóm</p>
              </div>
            </div>
            <button
              onClick={() => { setShowAddUserModal(true) }}
              disabled={!canManageUsers}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Thêm nhân viên
            </button>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chưa có nhân viên nào trong hệ thống.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Tên</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Liên hệ</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Vai trò</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Trạng thái</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-4 py-3 text-foreground flex items-center gap-2">
                        <span className="text-lg">{u.avatar || '👤'}</span>
                        {u.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{u.email}</div>
                        <div className="text-xs">{u.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${getRoleColor(u.role)}`}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${u.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {u.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(u)}
                            disabled={!canManageUsers}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded disabled:cursor-not-allowed disabled:opacity-60"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={!canManageUsers || u.email === 'admin@bloemist.com'}
                            className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded disabled:cursor-not-allowed disabled:opacity-60"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <UserFormModal
        isOpen={showAddUserModal && canManageUsers}
        title="Thêm nhân viên mới"
        onClose={() => { setShowAddUserModal(false) }}
        onSubmit={handleAddUser}
        submitLabel="Thêm"
        isSubmitting={isSubmitting}
      />

      {/* Edit User Modal */}
      <UserFormModal
        isOpen={showEditUserModal && canManageUsers}
        title="Chỉnh sửa nhân viên"
        onClose={() => { setShowEditUserModal(false); setEditingUser(null) }}
        onSubmit={handleUpdateUser}
        submitLabel="Lưu thay đổi"
        initialData={editingUser ? {
          name: editingUser.name,
          email: editingUser.email,
          phone: editingUser.phone || '',
          role: editingUser.role
        } : undefined}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
