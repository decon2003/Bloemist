/** Error carrying an HTTP status, recognised by handleRouteError.
 *
 *  Lives in its own module so that both data-store.ts and validation.ts can use
 *  it without an import cycle. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Vietnamese names for request fields, so validation errors read naturally.
const FIELD_LABELS: Record<string, string> = {
  name: 'Họ tên',
  email: 'Email',
  phone: 'Số điện thoại',
  role: 'Vai trò',
  status: 'Trạng thái',
  avatar: 'Ảnh đại diện',
  password: 'Mật khẩu',
  newPassword: 'Mật khẩu mới',
  payType: 'Hình thức lương',
  baseSalary: 'Lương cứng',
  hourlyRate: 'Lương giờ',
  holidayHourlyRate: 'Lương giờ ngày lễ',
  onlineHourlyRate: 'Lương giờ online',
  commissionRate: '% HH làm đơn',
  salesCommissionRate: '% HH sale',
  listedPrice: 'Giá niêm yết',
  deliveryFee: 'Phí ship',
  deposit: 'Tiền cọc',
  price: 'Giá',
  vatPercent: 'VAT',
  deliveryType: 'Hình thức giao',
}

export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field
