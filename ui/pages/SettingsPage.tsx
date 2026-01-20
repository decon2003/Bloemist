'use client'

import React, { useState } from 'react'
import { Bell, Shield, Users, Plus, Edit2, Trash2, X, MapPin, Clock } from 'lucide-react'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { useAppData } from '@/components/providers/app-data-provider'
import { StoreLocation, User } from '@/lib/types'
import { MapPreview } from '@/components/map-preview'
import { DateFilterSwitcher, DateRange } from '@/components/date-filter-switcher'
import { useViewSettings } from '@/components/providers/view-settings-provider'

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

const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'Admin User',
    email: 'admin@bloemist.com',
    phone: '+1 555-0001',
    role: 'boss',
    status: 'active',
    avatar: '👩‍💼',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-2',
    name: 'Sarah Chen',
    email: 'florist@bloemist.com',
    phone: '+1 555-0002',
    role: 'sales',
    status: 'active',
    avatar: '👩‍🌾',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-3',
    name: 'Tech Admin',
    email: 'tech@bloemist.com',
    phone: '+1 555-0003',
    role: 'admin',
    status: 'active',
    avatar: '👨‍💻',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-4',
    name: 'Olivia Reyes',
    email: 'olivia@bloemist.com',
    phone: '+1 555-0004',
    role: 'sales',
    status: 'active',
    avatar: '👩',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-5',
    name: 'Miguel Santos',
    email: 'miguel@bloemist.com',
    phone: '+1 555-0005',
    role: 'sales',
    status: 'disabled',
    avatar: '👨',
    createdAt: new Date().toISOString(),
  },
]

export default function SettingsPage() {
  const { t, lang } = useLocale()
  const { user } = useAuth()
  const { dateFilterMode, setDateFilterMode } = useViewSettings()
  const { users: appUsers, settings } = useAppData()
  const [users, setUsers] = React.useState<User[]>([])

  React.useEffect(() => {
    setUsers(appUsers)
  }, [appUsers])

  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'sales' as User['role'],
    password: '',
  })
  const [storeLocations, setStoreLocations] = useState<StoreLocation[]>([])
  const [workingHours, setWorkingHours] = useState({ start: '08:00', end: '18:00' })

  React.useEffect(() => {
    if (settings) {
      setStoreLocations(settings.storeLocations)
      setWorkingHours(settings.workingHours)
    }
  }, [settings])
  const [locationForm, setLocationForm] = useState({
    label: '',
    address: '',
    lat: '',
    lng: '',
  })
  const [viewSelectedDate, setViewSelectedDate] = useState('')
  const [viewDateRange, setViewDateRange] = useState<DateRange>({ from: '', to: '' })
  const parsedLat = parseFloat(locationForm.lat.trim() === '' ? '0' : locationForm.lat)
  const parsedLng = parseFloat(locationForm.lng.trim() === '' ? '0' : locationForm.lng)

  const canManageUsers = user?.role === 'boss' || user?.role === 'admin'
  const canEditSettings = canManageUsers
  const isLocationFormValid = !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)
  const locationPreviewReady = isLocationFormValid
  const workingHoursLabel =
    workingHours.start && workingHours.end
      ? `${workingHours.start} - ${workingHours.end}`
      : t('settings.workingHoursUnset', 'Not set')

  const handleAddUser = () => {
    if (!canManageUsers) return

    if (formData.name && formData.email && formData.phone && formData.role) {
      const newUser: User = {
        id: `user-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        status: 'active',
        avatar: '👤',
        createdAt: new Date().toISOString(),
      }
      setUsers([...users, newUser])
      setFormData({ name: '', email: '', phone: '', role: 'sales', password: '' })
      setShowAddUserModal(false)
    }
  }

  const handleAddStoreLocation = () => {
    if (!canEditSettings) return

    const lat = parsedLat
    const lng = parsedLng
    if (Number.isNaN(lat) || Number.isNaN(lng)) return

    const fallbackLabel = t('settings.locationFallback', 'New store location')
    const label = locationForm.label.trim() || fallbackLabel

    const newLocation: StoreLocation = {
      id: `store-${Date.now()}`,
      label,
      address: locationForm.address || undefined,
      coordinates: { lat, lng },
    }
    setStoreLocations([...storeLocations, newLocation])
    setLocationForm({ label: '', address: '', lat: '', lng: '' })
  }

  const handleRemoveStoreLocation = (id: string) => {
    if (!canEditSettings) return

    setStoreLocations((prev) => prev.filter((location) => location.id !== id))
  }

  const handleWorkingHoursChange = (field: 'start' | 'end', value: string) => {
    if (!canEditSettings) return

    setWorkingHours((prev) => ({ ...prev, [field]: value }))
  }

  const handleToggleUserStatus = (userId: string) => {
    if (!canManageUsers) return

    setUsers(users.map(u =>
      u.id === userId
        ? { ...u, status: u.status === 'active' ? 'disabled' : 'active' }
        : u
    ))
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
          Configure notifications, team permissions, and workspace preferences for your florist studio.
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            'settings.sessionNotice',
            'Settings load from your session only. The backend validates any changes when admins or bosses save updates.',
          )}
        </p>
        {!canEditSettings && (
          <div className="rounded-2xl border border-dashed border-muted bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('settings.viewingOnly')}
          </div>
        )}
      </div>

      <section className="space-y-4 rounded-3xl border border-border bg-white/90 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('settings.viewSettingsTitle', 'View settings')}
            </p>
            <h2 className="text-2xl font-semibold text-foreground">
              {t('settings.viewSettingsSubtitle', 'Pick how date filters appear across the workspace')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.viewSettingsDescription',
                'Preferences are stored in your session only and never sent to the backend.',
              )}
            </p>
          </div>
          <div className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary">
            {t('settings.viewSettingsAudience', 'All roles can view and adjust')}
          </div>
        </div>
        <DateFilterSwitcher
          label={t('settings.datePickerMode', 'Date picker mode')}
          mode={dateFilterMode}
          onModeChange={setDateFilterMode}
          selectedDate={viewSelectedDate}
          onSelectDate={setViewSelectedDate}
          range={viewDateRange}
          onRangeChange={setViewDateRange}
          modeLabels={{
            range: t('dateFilter.mode.range', 'Date range'),
            carousel: t('dateFilter.mode.carousel', 'Date carousel'),
          }}
          rangeLabels={{
            from: t('tasks.dateFilter.from', 'From date'),
            to: t('tasks.dateFilter.to', 'To date (optional)'),
          }}
          quickLabels={{
            today: t('tasks.dateLabels.today', 'Today'),
            tomorrow: t('tasks.dateLabels.tomorrow', 'Tomorrow'),
            dayAfter: t('tasks.dateLabels.dayAfter', 'Day after tomorrow'),
            threeDays: t('tasks.dateLabels.dayMoreAfter', 'In three days'),
            allDays: t('tasks.dateFilter.all', 'All dates'),
          }}
          calendarLabel={t('orders.dateFilter.openCalendar', 'Pick date from calendar')}
          clearLabel={t('tasks.dateFilter.all')}
          todayLabel={t('tasks.dateLabels.today', 'Today')}
          weekDayLabels={undefined}
          locale={lang === 'vi' ? 'vi-VN' : undefined}
        />
      </section>

      <section className="space-y-6 rounded-3xl border border-border bg-white/90 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('settings.storeLocationsTitle', 'Store locations')}
            </p>
            <h2 className="text-2xl font-semibold text-foreground">
              {t('settings.storeLocationsSubtitle', 'Manage coordinates for check-ins')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('settings.storeLocationsDescription', 'Choose the stores that count as “at office” for attendance.')}
            </p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {storeLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('settings.locationsEmpty', 'No store locations configured yet.')}
              </p>
            ) : (
              storeLocations.map((location) => (
                <div key={location.id} className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-foreground">{location.label}</p>
                      {location.address && <p className="text-xs text-muted-foreground">{location.address}</p>}
                      <p className="text-xs text-muted-foreground">
                        {location.coordinates.lat.toFixed(4)}, {location.coordinates.lng.toFixed(4)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStoreLocation(location.id)}
                      disabled={!canEditSettings}
                      className="rounded-full border border-border/60 p-2 text-muted-foreground transition hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <MapPreview
                    coordinates={location.coordinates}
                    label={location.label}
                    timestampLabel={t('settings.mapSaved', 'Saved coordinate')}
                    className="h-48"
                  />
                </div>
              ))
            )}
          </div>
          <div className="space-y-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5">
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-primary/30 bg-white/70 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('settings.storeManualSteps', 'How to capture coordinates')}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>{t('settings.stepSearchMap', 'Search location on Google Maps')}</li>
                  <li>{t('settings.stepRightClick', 'Right-click on the found location')}</li>
                  <li>{t('settings.stepCopyCoords', 'Copy the coordinates (X, Y) and paste them into the form')}</li>
                </ol>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('settings.addStoreLabel', 'Location label')}
                </label>
                <input
                  type="text"
                  value={locationForm.label}
                  onChange={(e) => setLocationForm((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder={t('settings.addStoreLabelPlaceholder', 'Bloemist Studio — West Gate')}
                  disabled={!canEditSettings}
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground disabled:bg-muted disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('settings.addStoreAddress', 'Address (optional)')}
                </label>
                <input
                  type="text"
                  value={locationForm.address}
                  onChange={(e) => setLocationForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Flower Ln, Springfield"
                  disabled={!canEditSettings}
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground disabled:bg-muted disabled:cursor-not-allowed"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('settings.addStoreLat', 'Latitude')}
                  </label>
                  <input
                    type="number"
                    value={locationForm.lat}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, lat: e.target.value }))}
                    placeholder="37.7749"
                    disabled={!canEditSettings}
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('settings.addStoreLng', 'Longitude')}
                  </label>
                  <input
                    type="number"
                    value={locationForm.lng}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, lng: e.target.value }))}
                    placeholder="-122.4194"
                    disabled={!canEditSettings}
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              {locationPreviewReady && (
                <MapPreview
                  coordinates={{ lat: parseFloat(locationForm.lat), lng: parseFloat(locationForm.lng) }}
                  label={locationForm.label || t('settings.locationPreview', 'New pin')}
                  timestampLabel={t('settings.previewOnly', 'Preview only — not saved yet')}
                  className="h-48"
                />
              )}
              <button
                type="button"
                onClick={handleAddStoreLocation}
                disabled={!canEditSettings || !isLocationFormValid}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MapPin className="h-4 w-4" />
                {t('settings.addStoreAction', 'Save location')}
              </button>
              <p className="text-xs text-muted-foreground">
                {t('settings.coordinatesNote', 'Paste coordinates from Google Maps right-click details. Only coordinates are stored to validate check-ins.')}
              </p>
            </div>
          </div>
        </div>
      </section>

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
              {t('settings.workingHoursStart', 'Start time')}
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
              {t('settings.workingHoursEnd', 'End time')}
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
        <div className="rounded-2xl border border-dashed border-muted bg-muted/40 p-4 text-sm text-muted-foreground">
          {t('settings.workingHoursHelper', 'All check-in lists display this window next to every entry.')}
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
              Manage
            </button>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('settings.userManagement.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('settings.userManagement.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => canManageUsers && setShowAddUserModal(true)}
            disabled={!canManageUsers}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {t('settings.userManagement.addUser')}
          </button>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-semibold text-foreground">{t('settings.userManagement.table.name')}</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">{t('settings.userManagement.table.contact')}</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">{t('settings.userManagement.table.role')}</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">{t('settings.userManagement.table.status')}</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">{t('settings.userManagement.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 text-foreground flex items-center gap-2">
                    <span className="text-lg">{u.avatar}</span>
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
                      {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleUserStatus(u.id)}
                        disabled={!canManageUsers}
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {u.status === 'active' ? '✓' : '×'}
                      </button>
                      <button
                        disabled={!canManageUsers}
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && canManageUsers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-foreground">{t('settings.userManagement.modal.title')}</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('settings.userManagement.form.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('settings.userManagement.form.email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="user@bloemist.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('settings.userManagement.form.phone')}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 555-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('settings.userManagement.form.role')}</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="sales">Sales</option>
                  <option value="florist">Florist</option>
                  <option value="boss">Boss</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('settings.userManagement.form.password')}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Temporary password"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                onClick={() => setShowAddUserModal(false)}
                className="px-4 py-2 text-foreground border border-border rounded-lg hover:bg-muted"
              >
                {t('settings.userManagement.modal.cancel')}
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                {t('settings.userManagement.modal.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
