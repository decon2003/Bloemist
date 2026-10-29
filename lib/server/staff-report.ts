import db from './db'

export type StaffReportRow = {
  profile: {
    id: string
    name: string
    title: string
    specialty: string
    baseSalary?: number
    commissionRate?: number
  }
  checkins: number
  /** Hours of closed shifts in the month (auto-closed shifts included until fixed). */
  hours: number
  orders: number
  tasks: number
  tasksInProgress: number
  tasksCompleted: number
  salary: number
  commissionAmount: number
  lastSeen: string | null
  lastLocation: string | null
}

const titleFor = (role: string) => (role === 'florist' ? 'Thợ hoa' : role === 'sales' ? 'Sale' : 'Quản trị viên')

/** Monthly attendance, workload and pay per staff member, computed on the
 *  server from just that month's rows. The page used to download every order,
 *  task and check-in ever recorded and do this in the browser.
 *
 *  Pay = base salary + commission, where commission is
 *   - sales: rate% of each non-cancelled order they created that month
 *     (selling price, or total when no selling price), and
 *   - florists: rate% of the price of each task they completed that month. */
export async function getStaffReport(month: { start: Date; end: Date }): Promise<StaffReportRow[]> {
  const inMonth = { gte: month.start, lt: month.end }

  const [users, checkins, orders, completedTasks, inProgress] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, role: true, baseSalary: true, commissionRate: true } }),
    db.staffCheckIn.findMany({
      where: { timestamp: inMonth },
      select: { staffId: true, staffName: true, discipline: true, timestamp: true, locationLabel: true, ordersTouched: true, completedTasks: true, workingHours: true },
    }),
    db.order.findMany({
      where: { createdAt: inMonth, status: { not: 'CANCELLED' }, createdById: { not: null } },
      select: { createdById: true, sellingPrice: true, total: true },
    }),
    db.task.findMany({
      where: { status: 'COMPLETED', completedAt: inMonth, assigneeId: { not: null } },
      select: { assigneeId: true, price: true },
    }),
    db.task.groupBy({ by: ['assigneeId'], where: { status: 'IN_PROGRESS', assigneeId: { not: null } }, _count: true }),
  ])

  const rows = new Map<string, StaffReportRow>()
  const blank = (profile: StaffReportRow['profile']): StaffReportRow => ({
    profile,
    checkins: 0,
    hours: 0,
    orders: 0,
    tasks: 0,
    tasksInProgress: 0,
    tasksCompleted: 0,
    salary: 0,
    commissionAmount: 0,
    lastSeen: null,
    lastLocation: null,
  })

  for (const user of users) {
    // The admin account manages the shop; it is not staff (unless it checks in).
    if (user.role === 'admin') continue
    rows.set(
      user.id,
      blank({
        id: user.id,
        name: user.name,
        title: titleFor(user.role),
        specialty: user.role,
        baseSalary: user.baseSalary ?? undefined,
        commissionRate: user.commissionRate ?? undefined,
      }),
    )
  }

  for (const entry of checkins) {
    // Keep history for staff whose account has since been deleted.
    if (!rows.has(entry.staffId)) {
      rows.set(
        entry.staffId,
        blank({ id: entry.staffId, name: entry.staffName, title: titleFor(entry.discipline), specialty: entry.discipline }),
      )
    }
    const row = rows.get(entry.staffId)!
    row.checkins += 1
    row.hours += entry.workingHours ?? 0
    row.orders += entry.ordersTouched
    row.tasks += entry.completedTasks
    const seen = entry.timestamp.toISOString()
    if (!row.lastSeen || seen > row.lastSeen) {
      row.lastSeen = seen
      row.lastLocation = entry.locationLabel
    }
  }

  for (const order of orders) {
    const row = rows.get(order.createdById!)
    if (!row) continue
    row.commissionAmount += (order.sellingPrice || order.total) * ((row.profile.commissionRate ?? 0) / 100)
  }

  for (const task of completedTasks) {
    const row = rows.get(task.assigneeId!)
    if (!row) continue
    row.tasksCompleted += 1
    row.commissionAmount += (task.price ?? 0) * ((row.profile.commissionRate ?? 0) / 100)
  }

  for (const group of inProgress) {
    const row = group.assigneeId ? rows.get(group.assigneeId) : undefined
    if (row) row.tasksInProgress = group._count
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      hours: Math.round(row.hours * 100) / 100,
      commissionAmount: Math.round(row.commissionAmount),
      salary: Math.round((row.profile.baseSalary ?? 0) + row.commissionAmount),
    }))
    .sort((a, b) => a.profile.name.localeCompare(b.profile.name, 'vi'))
}
