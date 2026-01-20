'use client'

import { useMemo, useState } from 'react'
import { ShieldAlert, Clock, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { useAppData } from '@/components/providers/app-data-provider'
import { StaffCheckIn } from '@/lib/types'
import { cn, formatDateTime } from '@/lib/utils'

const dayKey = (value: string | Date) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const statusBadgeClass = (state: 'store' | 'pending' | 'approved') => {
  switch (state) {
    case 'store':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
    case 'approved':
      return 'bg-sky-50 text-sky-700 border border-sky-100'
    default:
      return 'bg-amber-50 text-amber-700 border border-amber-100'
  }
}

export default function CheckinPage() {
  const { user } = useAuth()
  const { lang, t } = useLocale()
  const { checkins, settings, createCheckIn, checkOut } = useAppData()
  const now = useMemo(() => new Date(), [])

  // State for Admin View
  const [selectedDate, setSelectedDate] = useState<string>(dayKey(new Date()))

  // State for Staff View
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'boss'

  const workspaceSettings = useMemo(() => settings || {
    storeLocations: [],
    workingHours: { start: '08:00', end: '18:00' }
  }, [settings])

  // Staff View: My checkins for current month
  const myMonthlyCheckins = useMemo(() => {
    if (!user) return []
    return checkins
      .filter((entry) => {
        const stamp = new Date(entry.timestamp)
        return entry.staffId === user.id && stamp.getFullYear() === now.getFullYear() && stamp.getMonth() === now.getMonth()
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [user, now, checkins])

  const todayCheckIn = useMemo(
    () => myMonthlyCheckins.find((entry) => dayKey(entry.timestamp) === dayKey(now)) ?? null,
    [myMonthlyCheckins, now],
  )

  // Admin View: All checkins for selected date
  const adminDailyCheckins = useMemo(() => {
    return checkins
      .filter((entry) => dayKey(entry.timestamp) === selectedDate)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [checkins, selectedDate])

  const handleCheckIn = async () => {
    if (!user || isSubmitting) return

    setIsSubmitting(true)
    try {
      await createCheckIn({
        staffId: user.id,
        staffName: user.name,
        discipline: (user.role as any) || 'florist',
        locationLabel: 'Manual Check-in',
        locationType: 'AT_OFFICE',
        coordinates: { lat: 0, lng: 0 },
        distanceFromOfficeKm: 0,
        notes: ''
      })
    } catch (error) {
      console.error('Check-in failed:', error)
      alert(t('checkins.checkinError', 'Failed to check in. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCheckOut = async () => {
    if (!todayCheckIn || isSubmitting) return

    setIsSubmitting(true)
    try {
      await checkOut(todayCheckIn.id)
    } catch (error) {
      console.error('Check-out failed:', error)
      alert(t('checkins.checkoutError', 'Failed to check out. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const tableStatus = (entry: StaffCheckIn) => {
    return { label: t('checkins.tag.atStore', 'At store'), tone: 'store' as const }
  }

  const workingHoursLabel = `${workspaceSettings.workingHours.start} - ${workspaceSettings.workingHours.end}`

  if (isAdmin) {
    return (
      <div className="space-y-6 p-4 pb-20 md:p-8 md:pb-12">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Attendance Monitoring</h1>
            <p className="text-sm text-muted-foreground">Monitor checking in/out of all staff.</p>
          </div>
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </header>

        <section className="rounded-3xl border border-border bg-white/90 p-6">
          {adminDailyCheckins.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No check-ins found for this date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4 font-semibold">Staff</th>
                    <th className="px-4 py-3 font-semibold">Check-in</th>
                    <th className="px-4 py-3 font-semibold">Check-out</th>
                    <th className="px-4 py-3 font-semibold">Hours</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {adminDailyCheckins.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-4 pr-4 font-medium text-foreground">{entry.staffName}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {entry.checkInAt ? formatDateTime(entry.checkInAt, lang).split(',')[1] : '--'}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {entry.checkOutAt ? formatDateTime(entry.checkOutAt, lang).split(',')[1] : '--'}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{entry.workingHours ? `${entry.workingHours.toFixed(2)}h` : '--'}</td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold border",
                          entry.checkOutAt
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                          {entry.checkOutAt ? 'Completed' : 'Working'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    )
  }

  // Staff View
  return (
    <div className="space-y-6 p-4 pb-20 md:p-8 md:pb-12">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {t('checkins.subtitle', 'Monthly check-in')}
        </p>
        <h1 className="text-3xl font-bold text-foreground">{t('checkins.title', 'Check-in')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('checkins.actionDescription', 'Log your daily attendance.')}
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-3xl border border-border bg-white/90 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('checkins.currentSection', 'Today Status')}
              </p>
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                {todayCheckIn?.checkInAt
                  ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                      <span>{t('checkins.checkedInStatus', 'Already checked in today')}</span>
                    </>
                  )
                  : (
                    <>
                      <Clock className="h-6 w-6 text-muted-foreground" />
                      <span>{t('checkins.readyToCheckIn', 'Ready to check in')}</span>
                    </>
                  )
                }
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('checkins.workingHoursLabel', 'Working hours')}: {workingHoursLabel}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!todayCheckIn?.checkInAt ? (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={isSubmitting}
                  className="inline-flex h-12 px-8 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? '...' : t('checkins.checkinAction', 'Check In Now')}
                </button>
              ) : !todayCheckIn?.checkOutAt ? (
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={isSubmitting}
                  className="inline-flex h-12 px-8 items-center justify-center rounded-full bg-amber-500 text-base font-semibold text-white shadow-lg transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? '...' : t('checkins.checkout', 'Check Out')}
                </button>
              ) : (
                <div className="inline-flex h-12 px-6 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                  {t('checkins.completed', 'Shift Completed')}
                </div>
              )}
            </div>
          </div>

          {/* Simple Stats for Today */}
          {todayCheckIn && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground uppercase">{t('checkins.table.columns.checkin', 'Check-in time')}</p>
                <p className="text-lg font-semibold">{formatDateTime(todayCheckIn.checkInAt, lang)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">{t('checkins.table.columns.checkout', 'Check-out time')}</p>
                <p className="text-lg font-semibold">{todayCheckIn.checkOutAt ? formatDateTime(todayCheckIn.checkOutAt, lang) : '--:--'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-6 flex flex-col justify-center">
          <h3 className="font-semibold text-primary text-lg mb-2">Instructions</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Click <strong>Check In</strong> when you start your working day.</li>
            <li>Click <strong>Check Out</strong> when you finish your work.</li>
            <li>Working hours are calculated automatically.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white/90 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('checkins.table.title', 'Monthly check-ins')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('checkins.table.description', 'All GPS punches with working hours window attached.')}
            </p>
          </div>
        </div>
        {myMonthlyCheckins.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">{t('checkins.noEntries', 'No check-ins logged this month.')}</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-semibold">{t('checkins.table.columns.date', 'Date')}</th>
                  <th className="px-4 py-3 font-semibold">{t('checkins.table.columns.checkin', 'Check-in time')}</th>
                  <th className="px-4 py-3 font-semibold">{t('checkins.table.columns.checkout', 'Check-out time')}</th>
                  <th className="px-4 py-3 font-semibold">{t('checkins.table.columns.hours', 'Working hours')}</th>
                  <th className="px-4 py-3 font-semibold">{t('checkins.table.columns.type', 'Type')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myMonthlyCheckins.map((entry) => {
                  const tableTag = tableStatus(entry)
                  return (
                    <tr key={entry.id}>
                      <td className="py-4 pr-4 text-foreground">{formatDateTime(entry.timestamp, lang).split(',')[0]}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {entry.checkInAt ? formatDateTime(entry.checkInAt, lang) : formatDateTime(entry.timestamp, lang)}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {entry.checkOutAt ? formatDateTime(entry.checkOutAt, lang) : '--'}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{entry.workingHours ? `${entry.workingHours.toFixed(2)}h` : '--'}</td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                            statusBadgeClass(tableTag.tone),
                          )}
                        >
                          {tableTag.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
