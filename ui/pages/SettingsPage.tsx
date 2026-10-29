'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Users, Plus, Edit2, Trash2, X, Clock } from 'lucide-react'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { useAppData } from '@/components/providers/app-data-provider'
import { User } from '@/lib/types'
import { AuditTrail } from '@/components/audit-trail'
import { TimeInput24 } from '@/components/time-input-24'
import { DateInputVN } from '@/components/date-input-vn'

interface UserFormData {
  name: string
  email: string
  phone: string
  role: User['role']
  status: User['status']
  password: string
}

const ROLE_LABEL: Record<User['role'], string> = {
  admin: 'Quản trị viên',
  sales: 'Sale',
  florist: 'Thợ hoa',
}

const UserFormModal = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  submitLabel,
  initialData,
  isSubmitting,
  passwordRequired,
}: {
  isOpen: boolean
  title: string
  onClose: () => void
  onSubmit: (data: UserFormData) => void
  submitLabel: string
  initialData?: UserFormData
  isSubmitting: boolean
  /** New staff need a temporary password; when editing it is an optional reset. */
  passwordRequired: boolean
}) => {
  // Modal manages its own state
  const [localData, setLocalData] = useState<UserFormData>({
    name: '',
    email: '',
    phone: '',
    role: 'sales',
    status: 'active',
    password: '',
  })

  // Reset or initialize state when the modal opens (initialData is memoised by
  // the caller, so a re-render while saving no longer wipes what was typed).
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setLocalData(initialData)
      } else {
        setLocalData({ name: '', email: '', phone: '', role: 'sales', status: 'active', password: '' })
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
              {(Object.keys(ROLE_LABEL) as User['role'][]).map((role) => (
                <option key={role} value={role}>{ROLE_LABEL[role]}</option>
              ))}
            </select>
          </div>

          {!passwordRequired && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Trạng thái</label>
              <select
                value={localData.status}
                onChange={(e) => setLocalData(prev => ({ ...prev, status: e.target.value as User['status'] }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Đang làm việc</option>
                <option value="inactive">Đã nghỉ việc</option>
              </select>
              {localData.status === 'inactive' && (
                <p className="mt-1 text-xs text-amber-700">
                  Người đã nghỉ không đăng nhập được nữa và không có trong danh sách chọn người làm; sản phẩm chưa làm của họ
                  trở về &quot;Chưa có người làm&quot;. Lịch sử đơn và chấm công vẫn giữ nguyên.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {passwordRequired ? 'Mật khẩu tạm' : 'Cấp lại mật khẩu tạm'}
            </label>
            <input
              type="text"
              autoComplete="off"
              value={localData.password}
              onChange={(e) => setLocalData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={passwordRequired ? 'Ít nhất 8 ký tự' : 'Để trống nếu không đổi'}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Đưa trực tiếp cho nhân viên. Nhân viên sẽ phải đổi mật khẩu ở lần đăng nhập tiếp theo.
            </p>
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
  // Empty until the real hours load, so nothing wrong is shown (or saved) meanwhile.
  const [workingHours, setWorkingHours] = useState({ start: '', end: '' })
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([])
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' })
  const [holidayMessage, setHolidayMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (settings) {
      setWorkingHours(settings.workingHours)
      setHolidays(settings.holidays ?? [])
    }
  }, [settings])

  const saveHolidays = async (next: { date: string; name: string }[]) => {
    setHolidayMessage('')
    try {
      const { updateHolidays } = await import('@/lib/api')
      const saved = await updateHolidays(next)
      setHolidays(saved.holidays)
      setHolidayMessage('Đã lưu ngày lễ')
    } catch (error) {
      setHolidayMessage(error instanceof Error ? error.message : 'Không lưu được')
    }
  }

  const canManageUsers = user?.role === 'admin'
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

    if (data.password.length < 8) {
      alert('Mật khẩu tạm phải có ít nhất 8 ký tự')
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
        password: data.password,
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

  const editingInitialData = useMemo<UserFormData | undefined>(
    () =>
      editingUser
        ? {
            name: editingUser.name,
            email: editingUser.email,
            phone: editingUser.phone || '',
            role: editingUser.role,
            status: editingUser.status,
            password: '',
          }
        : undefined,
    [editingUser],
  )

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

    if (data.password && data.password.length < 8) {
      alert('Mật khẩu tạm phải có ít nhất 8 ký tự')
      return
    }

    setIsSubmitting(true)
    try {
      const { updateUser } = await import('@/lib/api')
      // Only what changed is sent (the main admin's email and role cannot be re-sent).
      const changes: Partial<User> = {}
      if (data.name !== editingUser.name) changes.name = data.name
      if (data.email !== editingUser.email) changes.email = data.email
      if (data.phone !== (editingUser.phone || '')) changes.phone = data.phone
      if (data.role !== editingUser.role) changes.role = data.role
      if (data.status !== editingUser.status) {
        if (data.status === 'inactive' && !confirm(`Chuyển ${editingUser.name} sang "Đã nghỉ việc"? Họ sẽ bị đăng xuất và không đăng nhập được nữa.`)) {
          setIsSubmitting(false)
          return
        }
        changes.status = data.status
      }
      if (data.password) changes.password = data.password
      if (Object.keys(changes).length === 0) {
        setShowEditUserModal(false)
        setEditingUser(null)
        setIsSubmitting(false)
        return
      }
      await updateUser(editingUser.id, changes)
      alert(data.password ? 'Đã cập nhật và cấp mật khẩu tạm mới.' : 'Cập nhật thành công!')
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

  const [hoursMessage, setHoursMessage] = useState('')
  const [savingHours, setSavingHours] = useState(false)

  // Closing time is also when forgotten check-outs are closed automatically.
  const saveWorkingHours = async () => {
    setSavingHours(true)
    setHoursMessage('')
    try {
      const { updateWorkingHours } = await import('@/lib/api')
      const saved = await updateWorkingHours(workingHours)
      setWorkingHours(saved.workingHours)
      setHoursMessage('Đã lưu giờ làm việc')
    } catch (error) {
      setHoursMessage(error instanceof Error ? error.message : 'Không lưu được')
    } finally {
      setSavingHours(false)
    }
  }

  const handleWorkingHoursChange = (field: 'start' | 'end', value: string) => {
    if (!canEditSettings) return
    setWorkingHours((prev) => ({ ...prev, [field]: value }))
  }

  const getRoleColor = (role: User['role']) => {
    switch (role) {
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
          Giờ làm việc, địa điểm điểm danh và tài khoản nhân viên.
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
            <TimeInput24
              value={workingHours.start}
              onChange={(value) => handleWorkingHoursChange('start', value)}
              disabled={!canEditSettings}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Giờ kết thúc
            </label>
            <TimeInput24
              value={workingHours.end}
              onChange={(value) => handleWorkingHoursChange('end', value)}
              disabled={!canEditSettings}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Giờ làm ngoài khung này (từ 15 phút trở lên) tính là OT, quản lý duyệt trong Bảng lương. Đổi giờ giữa tháng sẽ tính
          lại OT của cả tháng khi cập nhật bảng lương nháp.
        </p>
        {canEditSettings && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveWorkingHours}
              disabled={savingHours || !settings}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingHours ? 'Đang lưu...' : 'Lưu giờ làm việc'}
            </button>
            {hoursMessage && <span className="text-sm text-muted-foreground">{hoursMessage}</span>}
          </div>
        )}
      </section>

      {/* Public holidays */}
      <section className="space-y-4 rounded-3xl border border-border bg-white/90 p-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Ngày lễ</h2>
            <p className="text-sm text-muted-foreground">
              Ngày lễ, nhân viên lương theo giờ được tính đơn giá giờ ngày lễ (trong Hồ sơ lương); người lương cứng tính như ngày thường.
            </p>
          </div>
        </div>
        {holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có ngày lễ nào.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {holidays.map((h) => (
              <li key={h.date} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium text-foreground">{h.date.split('-').reverse().join('/')}</span>
                  {h.name && <span className="text-muted-foreground"> · {h.name}</span>}
                </span>
                {canEditSettings && (
                  <button
                    type="button"
                    onClick={() => saveHolidays(holidays.filter((x) => x.date !== h.date))}
                    className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    title="Bỏ ngày lễ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEditSettings && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <DateInputVN
              value={newHoliday.date}
              onChange={(value) => setNewHoliday((h) => ({ ...h, date: value }))}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <input
              value={newHoliday.name}
              onChange={(e) => setNewHoliday((h) => ({ ...h, name: e.target.value }))}
              placeholder="Tên ngày lễ, ví dụ: Quốc khánh"
              className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!newHoliday.date}
              onClick={() => {
                saveHolidays([...holidays.filter((x) => x.date !== newHoliday.date), newHoliday])
                setNewHoliday({ date: '', name: '' })
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Thêm ngày lễ
            </button>
          </div>
        )}
        {holidayMessage && <p className="text-sm text-muted-foreground">{holidayMessage}</p>}
      </section>

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
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${u.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {u.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ việc'}
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

      {canManageUsers && <AuditTrail title="Hoạt động gần đây" />}

      {/* Add User Modal */}
      <UserFormModal
        isOpen={showAddUserModal && canManageUsers}
        title="Thêm nhân viên mới"
        onClose={() => { setShowAddUserModal(false) }}
        onSubmit={handleAddUser}
        submitLabel="Thêm"
        isSubmitting={isSubmitting}
        passwordRequired
      />

      {/* Edit User Modal */}
      <UserFormModal
        isOpen={showEditUserModal && canManageUsers}
        title="Chỉnh sửa nhân viên"
        onClose={() => { setShowEditUserModal(false); setEditingUser(null) }}
        onSubmit={handleUpdateUser}
        submitLabel="Lưu thay đổi"
        initialData={editingInitialData}
        isSubmitting={isSubmitting}
        passwordRequired={false}
      />
    </div>
  )
}
