'use client'

import { useEffect, useState } from 'react'
import { fetchAudit } from '@/lib/api'
import type { AuditEntry } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

const ACTION_LABELS: Record<string, string> = {
  'order.create': 'Tạo đơn',
  'order.update': 'Sửa đơn',
  'order.delete': 'Xoá đơn',
  'order.assign': 'Giao đơn',
  'task.create': 'Tạo việc',
  'task.update': 'Sửa việc',
  'task.status': 'Đổi trạng thái việc',
  'task.assign': 'Giao việc',
  'task.unassign': 'Bỏ giao việc',
  'task.notes': 'Sửa ghi chú việc',
  'task.complete': 'Hoàn thành việc',
  'user.create': 'Thêm nhân viên',
  'user.update': 'Sửa nhân viên',
  'user.password_reset': 'Cấp lại mật khẩu',
  'user.delete': 'Xoá nhân viên',
  'customer.update': 'Sửa khách hàng',
  'checkin.correct': 'Sửa giờ chấm công',
  'checkin.backfill': 'Chấm công bù',
  'checkin.auto_close': 'Quên chấm công ra',
  'checkin.delete': 'Xoá ca chấm công',
  'payroll.create': 'Tạo bảng lương',
  'payroll.refresh': 'Cập nhật bảng lương',
  'payroll.line_update': 'Sửa dòng lương',
  'payroll.settings': 'Đổi hệ số OT',
  'payroll.lock': 'Chốt bảng lương',
  'payroll.unlock': 'Mở khoá bảng lương',
  'settings.update': 'Đổi cài đặt',
  'auth.login': 'Đăng nhập',
  'auth.login_failed': 'Đăng nhập sai',
  'auth.locked': 'Khoá tài khoản tạm thời',
  'auth.password_changed': 'Đổi mật khẩu',
}

const FIELD_LABELS: Record<string, string> = {
  customerName: 'Tên khách',
  customerPhone: 'SĐT khách',
  receiverName: 'Người nhận',
  receiverPhone: 'SĐT người nhận',
  deliveryAddress: 'Địa chỉ',
  bouquetName: 'Bó hoa',
  deliveryType: 'Hình thức giao',
  status: 'Trạng thái',
  receiveTime: 'Giờ nhận',
  listedPrice: 'Giá niêm yết',
  deliveryFee: 'Phí ship',
  deliveryCoveredByShop: 'Tiệm chịu ship',
  vatPercent: 'VAT %',
  deposit: 'Tiền cọc',
  sellingPrice: 'Giá bán',
  total: 'Tổng tiền',
  remainingBalance: 'Còn phải thu',
  notes: 'Ghi chú',
  assigneeName: 'Người làm',
  taskTitle: 'Tên việc',
  dueTime: 'Hạn',
  price: 'Giá việc',
  quantity: 'Số lượng',
  type: 'Loại việc',
  samplePhotoUrls: 'Ảnh mẫu',
  name: 'Tên',
  email: 'Email',
  phone: 'SĐT',
  role: 'Vai trò',
  avatar: 'Ảnh đại diện',
  baseSalary: 'Lương cơ bản',
  commissionRate: 'Hoa hồng %',
  source: 'Nguồn khách',
  marketingConsent: 'Đồng ý quảng cáo',
  checkInAt: 'Giờ vào',
  checkOutAt: 'Giờ ra',
  workingHours: 'Số giờ',
  openTime: 'Giờ mở cửa',
  closeTime: 'Giờ đóng cửa',
  holidays: 'Ngày lễ',
  otMultiplier: 'Hệ số OT',
  payType: 'Hình thức lương',
  hourlyRate: 'Đơn giá giờ',
  holidayHourlyRate: 'Đơn giá giờ ngày lễ',
  daysOffPerMonth: 'Ngày nghỉ/tháng',
  salesCommissionRate: 'Hoa hồng sale %',
}

const show = (value: unknown, lang: string) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return value.toLocaleString('vi-VN')
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return `${value.length} ảnh`
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value, lang)
  return String(value)
}

/** Who changed what and when, for managers. With no entity it shows the
 *  latest activity across the shop. */
export function AuditTrail({
  entity,
  entityId,
  title = 'Lịch sử thay đổi',
  lang = 'vi',
}: {
  entity?: string
  entityId?: string
  title?: string
  lang?: string
}) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchAudit({ entity, entityId })
      .then((result) => active && setRows(result))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Không tải được lịch sử'))
    return () => {
      active = false
    }
  }, [entity, entityId])

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">Chưa có thay đổi nào được ghi lại.</p>}
      <ol className="space-y-3">
        {rows?.map((row) => (
          <li key={row.id} className="border-l-2 border-border pl-3 text-sm">
            <p className="text-foreground">
              <span className="font-medium">{ACTION_LABELS[row.action] ?? row.action}</span>
              {row.summary ? <span className="text-muted-foreground"> · {row.summary}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(row.at, lang)} · {row.userName ?? 'Không rõ'}
            </p>
            {row.changes && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {Object.entries(row.changes).map(([field, [before, after]]) => (
                  <li key={field}>
                    {FIELD_LABELS[field] ?? field}: <span className="line-through">{show(before, lang)}</span> →{' '}
                    <span className="text-foreground">{show(after, lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
