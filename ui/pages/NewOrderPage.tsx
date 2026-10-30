'use client'

import { ImagePlus } from 'lucide-react'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/providers/locale-provider'
import { useAppData } from '@/components/providers/app-data-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { PhotoViewer } from '@/components/photo-viewer'
import { fetchBouquets, lookupCustomer, uploadPhoto } from '@/lib/api'
import type { BouquetSuggestion, CustomerLookup } from '@/lib/types'
import { formatCurrencyFromNumber, formatCurrencyInput, parseCurrencyToNumber, toDateTimeLocalValue } from '@/lib/utils'
import { thumbUrl } from '@/lib/image-compress'
import { DateTimeInput24 } from '@/components/time-input-24'


type ProductForm = {
  name: string
  quantity: number
  /** Typed unit price; the line total is what the maker earns commission on. */
  unitPrice: string
  note?: string
  samplePhotoUrls: string[]
}

export default function NewOrderPage() {
  const router = useRouter()
  const { lang, getDeliveryLabel } = useLocale()
  const { createOrder, florists, users } = useAppData()
  const { user } = useAuth()

  const [customerName, setCustomerName] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  // Whoever brought the order in earns the sales commission; defaults to the creator.
  const [salespersonId, setSalespersonId] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  // Freeship: the customer pays no delivery fee (stored as deliveryCoveredByShop).
  const [freeship, setFreeship] = useState(false)
  // VAT only when the customer asks for an invoice: enter it then, otherwise 0%.
  const [vatPercent, setVatPercent] = useState<number>(0)
  const [deposit, setDeposit] = useState('')
  // Paid in full: the deposit follows the total as prices change.
  const [paidInFull, setPaidInFull] = useState(false)
  // "Bán tại cửa hàng": the customer pays and takes the flowers now. No
  // receiver, delivery or time to enter; the florist who made it is required.
  const [walkIn, setWalkIn] = useState(false)
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [receiveTime, setReceiveTime] = useState(() => toDateTimeLocalValue(new Date()))
  const [notes, setNotes] = useState('')
  const [cardMessage, setCardMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Sample photos still uploading: the order waits for them.
  const [uploading, setUploading] = useState(0)
  // One id per order being created: a retry after a lost reply returns the
  // order already created instead of a duplicate.
  const [requestId] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  )
  const [products, setProducts] = useState<ProductForm[]>([
    { name: '', quantity: 1, unitPrice: '', note: '', samplePhotoUrls: [] },
  ])
  const [knownCustomer, setKnownCustomer] = useState<CustomerLookup | null>(null)
  // "Người đặt là người nhận": the receiver mirrors the customer's name and phone.
  const [receiverIsCustomer, setReceiverIsCustomer] = useState(false)
  const [customerNameAutofilled, setCustomerNameAutofilled] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)
  const [productPreviewUrl, setProductPreviewUrl] = useState<string | null>(null)

  // Look the phone number up once it is long enough to be a real number.
  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, '')
    if (digits.length < 9) {
      setKnownCustomer(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      lookupCustomer(customerPhone)
        .then((found) => {
          if (cancelled) return
          setKnownCustomer(found)
          // Fill the name only if the user has not typed one themselves.
          setCustomerName((current) => {
            if (found && (!current || customerNameAutofilled)) {
              setCustomerNameAutofilled(true)
              return found.name
            }
            if (!found && customerNameAutofilled) {
              setCustomerNameAutofilled(false)
              return ''
            }
            return current
          })
        })
        .catch(() => !cancelled && setKnownCustomer(null))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // customerNameAutofilled is read, not reacted to.
  }, [customerPhone])


  // Listed price is the sum of the product lines; the server recomputes it.
  const listedPrice = String(
    products.reduce((sum, product) => sum + parseCurrencyToNumber(product.unitPrice) * (product.quantity || 1), 0),
  )

  const {
    orderTotalValue,
    formattedOrderTotal,
    formattedRemainingBalance,
  } = useMemo(() => {
    const listedAmount = parseCurrencyToNumber(listedPrice)
    const deliveryAmount = parseCurrencyToNumber(deliveryFee)
    const vatRate = Number.isFinite(vatPercent) ? vatPercent : 0

    const basePriceValue = listedAmount
    const vatAmount = Math.round((basePriceValue * vatRate) / 100)
    const sellingPriceValue = basePriceValue + vatAmount
    const deliveryChargeValue = walkIn || deliveryType !== 'DELIVERY' || freeship ? 0 : deliveryAmount
    const orderTotalValue = sellingPriceValue + deliveryChargeValue
    const depositAmount = paidInFull || walkIn ? orderTotalValue : parseCurrencyToNumber(deposit)
    const remainingBalanceValue = Math.max(orderTotalValue - depositAmount, 0)

    return {
      orderTotalValue,
      formattedOrderTotal: formatCurrencyFromNumber(orderTotalValue),
      formattedRemainingBalance: formatCurrencyFromNumber(remainingBalanceValue),
    }
  }, [deliveryType, freeship, deliveryFee, deposit, paidInFull, walkIn, listedPrice, vatPercent])

  // Names (and latest photo) of bouquets on recent orders, for suggestions.
  const [bouquetSuggestions, setBouquetSuggestions] = useState<BouquetSuggestion[]>([])
  useEffect(() => {
    fetchBouquets().then(setBouquetSuggestions).catch(() => setBouquetSuggestions([]))
  }, [])
  const bouquetOptions = useMemo(
    () => bouquetSuggestions.map(({ name, image }) => ({ name, image: image ?? undefined })),
    [bouquetSuggestions],
  )

  const handleProductChange = (index: number, key: 'name' | 'quantity' | 'note' | 'unitPrice', value: string | number) => {
    setProducts((prev) =>
      prev.map((product, idx) => {
        if (idx !== index) return product
        if (key === 'quantity') {
          // Empty while typing (so "3" can replace "1"); checked on submit.
          return { ...product, quantity: Math.max(0, Math.floor(Number(value) || 0)) }
        }
        if (key === 'unitPrice') {
          return { ...product, unitPrice: formatCurrencyInput(String(value)) }
        }
        if (key === 'name') {
          return { ...product, name: String(value) }
        }
        return { ...product, note: String(value) }
      }),
    )
  }

  const addSamplePhotoToProduct = (index: number, url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setProducts((prev) =>
      prev.map((product, idx) =>
        idx === index
          ? { ...product, samplePhotoUrls: [...product.samplePhotoUrls, trimmed] }
          : product,
      ),
    )
  }

  const removeSamplePhotoFromProduct = (index: number, photoIndex: number) => {
    setProducts((prev) =>
      prev.map((product, idx) => {
        if (idx !== index) return product
        return {
          ...product,
          samplePhotoUrls: product.samplePhotoUrls.filter((_, photoIdx) => photoIdx !== photoIndex),
        }
      }),
    )
  }

  /** Upload sample photos (picked, taken or pasted) one after another. */
  const handleSampleFiles = async (index: number, files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setUploading((n) => n + images.length)
    const failed: string[] = []
    for (const file of images) {
      try {
        addSamplePhotoToProduct(index, await uploadPhoto(file))
      } catch (error) {
        failed.push(error instanceof Error ? error.message : 'Không tải được ảnh lên')
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (failed.length) alert(`${failed.length} ảnh không tải lên được: ${failed[0]}`)
  }

  /** Ctrl+V of a photo copied from Zalo/Messenger on a computer. */
  const handleSamplePaste = (index: number, event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files)
    if (!files.some((file) => file.type.startsWith('image/'))) return
    event.preventDefault()
    handleSampleFiles(index, files)
  }

  const addProductRow = () => {
    setProducts((prev) => [...prev, { name: '', quantity: 1, unitPrice: '', note: '', samplePhotoUrls: [] }])
  }

  const removeProductRow = (index: number) => {
    setProducts((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    if (uploading > 0) {
      setSubmitError('Ảnh mẫu đang tải lên, đợi xong rồi tạo đơn.')
      return
    }
    if (!walkIn && (!receiveTime || Number.isNaN(new Date(receiveTime).getTime()))) {
      setSubmitError('Vui lòng chọn ngày giờ nhận.')
      return
    }
    if (walkIn && !assigneeId) {
      setSubmitError('Chọn thợ đã làm bó hoa.')
      return
    }
    setIsSaving(true)
    setProductError(null)

    const preparedProducts = products.filter((product) => product.name.trim())
    if (preparedProducts.length === 0) {
      setProductError('Vui lòng nhập tên cho mỗi công việc.')
      setIsSaving(false)
      return
    }
    if (preparedProducts.some((product) => !product.unitPrice.trim())) {
      setProductError('Vui lòng nhập giá tiền cho từng sản phẩm.')
      setIsSaving(false)
      return
    }
    // "350k" would be read as 350 ₫: nothing in the shop costs under 1.000 ₫.
    if (preparedProducts.some((product) => parseCurrencyToNumber(product.unitPrice) < 1000)) {
      setProductError('Giá tiền phải từ 1.000 ₫. Gõ đủ số, ví dụ 350000 (không gõ "350k").')
      setIsSaving(false)
      return
    }
    if (preparedProducts.some((product) => !product.quantity || product.quantity < 1)) {
      setProductError('Số lượng mỗi sản phẩm phải từ 1.')
      setIsSaving(false)
      return
    }

    try {
      const primaryProduct = preparedProducts[0]
      const matched = bouquetOptions.find(
        (option) => option.name.toLowerCase() === primaryProduct.name.toLowerCase(),
      )

      const created = await createOrder({
        customerName,
        customerPhone,
        // Any of these may be left blank and filled in later on the order.
        receiverName: walkIn ? '' : receiverIsCustomer ? customerName : receiverName,
        receiverPhone: walkIn ? '' : receiverIsCustomer ? customerPhone : receiverPhone,
        bouquetName: primaryProduct.name,
        bouquetImage: primaryProduct.samplePhotoUrls[0] || matched?.image,
        // A shop sale: the server sets pickup, now, paid in full and delivered.
        walkIn,
        deliveryType: walkIn ? 'PICKUP' : deliveryType,
        deliveryAddress: !walkIn && deliveryType === 'DELIVERY' ? deliveryAddress : undefined,
        receiveTime: walkIn ? new Date().toISOString() : new Date(receiveTime).toISOString(),
        status: assigneeId ? 'IN_PROGRESS' : 'NEW',
        listedPrice,
        deliveryFee: !walkIn && deliveryType === 'DELIVERY' && !freeship ? deliveryFee : undefined,
        deliveryCoveredByShop: !walkIn && deliveryType === 'DELIVERY' && freeship,
        vatPercent,
        deposit: paidInFull || walkIn ? orderTotalValue : deposit,
        // Selling price, total and remaining balance are recomputed by the server.
        notes: walkIn ? '' : notes,
        cardMessage: walkIn ? '' : cardMessage,
        createdById: user?.id,
        createdByName: user?.name,
        requestId,
        assigneeId: assigneeId || undefined,
        assigneeName: florists.find((f) => f.id === assigneeId)?.name || undefined,
        salespersonId: salespersonId || user?.id,
        // The server creates one task per product in the same transaction.
        products: preparedProducts.map((product) => ({
          name: product.name,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          note: product.note,
          samplePhotoUrls: product.samplePhotoUrls,
          image: bouquetOptions.find((option) => option.name.toLowerCase() === product.name.toLowerCase())?.image,
        })),
      })

      router.push(`/${lang}/orders/${created.id}`)
    } catch (error) {
      console.error('Failed to create order', error)
      setSubmitError(
        error instanceof Error && error.message !== 'Failed to fetch'
          ? error.message
          : 'Mất kết nối khi tạo đơn. Bấm "Tạo đơn" lại: đơn sẽ không bị tạo trùng.',
      )
      setIsSaving(false)
    }
  }

  return (
    user?.role === 'florist' ? (
      <div className="space-y-4 p-4 md:p-8">
        <Link href={`/${lang}/orders`} className="inline-flex items-center gap-2 text-sm text-primary">
          Quay lại đơn hàng
        </Link>
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          Thợ hoa chỉ được xem đơn hàng, chỉ có Sales mới được tạo đơn mới.
        </div>
      </div>
    ) : (
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Đơn hàng mới</h1>
          </div>
          <Link
            href={`/${lang}/orders`}
            className="hidden rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted md:inline-block"
          >
            Quay lại đơn hàng
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div role="radiogroup" aria-label="Loại đơn" className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm">
            {([
              [false, 'Đặt hoa', 'Giao hoặc hẹn lấy sau'],
              [true, 'Bán tại cửa hàng', 'Khách trả tiền, lấy hoa luôn'],
            ] as const).map(([value, label, hint]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={walkIn === value}
                onClick={() => setWalkIn(value)}
                className={`rounded-xl px-3 py-2 text-left transition ${walkIn === value ? 'bg-primary text-white shadow-sm' : 'hover:bg-muted'}`}
              >
                <span className="block text-sm font-semibold">{label}</span>
                <span className={`block text-xs ${walkIn === value ? 'text-white/80' : 'text-muted-foreground'}`}>{hint}</span>
              </button>
            ))}
          </div>
          <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Thông tin đơn</h2>
              {walkIn && (
                <p className="text-sm text-muted-foreground">Tên và số điện thoại khách có thể bỏ trống (ghi là &quot;Khách lẻ&quot;).</p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Tên khách</span>
                <input
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value)
                    setCustomerNameAutofilled(false)
                  }}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/50"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Số điện thoại khách</span>
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  type="tel"
                  inputMode="tel"
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              {knownCustomer && (
                <div className="col-span-1 md:col-span-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm space-y-2">
                  <p className="font-medium text-foreground">
                    Khách cũ · {knownCustomer.orderCount} đơn
                    {knownCustomer.lastBouquet ? ` · lần trước: ${knownCustomer.lastBouquet}` : ''}
                  </p>
                  {knownCustomer.notes && <p className="text-muted-foreground italic">“{knownCustomer.notes}”</p>}
                  {knownCustomer.recentReceivers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-muted-foreground">Người nhận trước:</span>
                      {knownCustomer.recentReceivers.map((receiver) => (
                        <button
                          key={`${receiver.receiverName}|${receiver.receiverPhone}|${receiver.deliveryAddress ?? ''}`}
                          type="button"
                          onClick={() => {
                            setReceiverIsCustomer(false)
                            setReceiverName(receiver.receiverName)
                            setReceiverPhone(receiver.receiverPhone)
                            if (receiver.deliveryAddress) {
                              setDeliveryType('DELIVERY')
                              setDeliveryAddress(receiver.deliveryAddress)
                            }
                          }}
                          className="rounded-lg border border-border bg-white px-2 py-1 text-xs hover:border-primary"
                        >
                          {receiver.receiverName}
                          {receiver.deliveryAddress ? ` · ${receiver.deliveryAddress}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!walkIn && (<>
              <label className="col-span-1 flex items-center gap-2 text-sm font-medium text-foreground md:col-span-2">
                <input
                  type="checkbox"
                  checked={receiverIsCustomer}
                  onChange={(event) => setReceiverIsCustomer(event.target.checked)}
                  className="h-4 w-4"
                />
                Người đặt là người nhận
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Tên người nhận</span>
                <input
                  value={receiverIsCustomer ? customerName : receiverName}
                  disabled={receiverIsCustomer}
                  onChange={(event) => setReceiverName(event.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted/50"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Số điện thoại người nhận</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={receiverIsCustomer ? customerPhone : receiverPhone}
                  disabled={receiverIsCustomer}
                  onChange={(event) => setReceiverPhone(event.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted/50"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Hình thức giao</span>
                <select
                  value={deliveryType}
                  onChange={(event) => setDeliveryType(event.target.value as 'DELIVERY' | 'PICKUP')}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="DELIVERY">{getDeliveryLabel('DELIVERY')}</option>
                  <option value="PICKUP">{getDeliveryLabel('PICKUP')}</option>
                </select>
              </label>
              {deliveryType === 'DELIVERY' && (
                <label className="space-y-2 text-sm font-medium text-foreground col-span-1 md:col-span-2">
                  <span>Địa chỉ giao hàng</span>
                  <input
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Số nhà, tên đường, phường, quận..."
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              )}
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Thời gian nhận</span>
                <DateTimeInput24
                  value={receiveTime}
                  onChange={setReceiveTime}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              </>)}
            </div>

            {!walkIn && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Nội dung thiệp</span>
                <textarea
                  value={cardMessage}
                  onChange={(event) => setCardMessage(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Lời chúc trên thiệp, ví dụ: Chúc mừng sinh nhật mẹ yêu!"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Ghi chú đặc biệt</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ví dụ: không dùng hoa ly, gói giấy trắng, giao trước 9h"
                />
              </label>
            </div>
            )}
            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>
                {walkIn
                  ? 'Thợ đã làm bó hoa (được tính hoa hồng làm đơn)'
                  : 'Nhân viên phụ trách'}
              </span>
              <select
                aria-label={walkIn ? 'Thợ đã làm bó hoa' : 'Nhân viên phụ trách'}
                value={assigneeId}
                onChange={(event) => {
                  setAssigneeId(event.target.value)
                  setSubmitError(null)
                }}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Chọn</option>
                {florists.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Nhân viên sale</span>
              <select
                value={salespersonId || user?.id || ''}
                onChange={(event) => setSalespersonId(event.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {users
                  .filter((u) => u.status === 'active')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.role === 'admin' ? `${u.name} (chủ cửa hàng, không tính hoa hồng)` : u.name}
                    </option>
                  ))}
              </select>
            </label>
          </section >

          <section className="space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">Sản phẩm của đơn</h2>
              <p className="text-sm text-muted-foreground">
                Thêm sản phẩm. Mỗi dòng sẽ tạo một công việc cắm/bó hoa và có thể đính kèm ảnh gợi ý.
              </p>
            </div>
            <div className="space-y-3">
              {products.map((product, index) => (
                <div key={`product-${index}`} className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                  {/* Phone: the name takes the whole first row; quantity and price share the second. */}
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
                    <label className="col-span-2 space-y-1 text-sm font-medium text-foreground sm:flex-1">
                      <span>Sản phẩm trong đơn</span>
                      <input
                        required
                        onInvalid={(event) => event.currentTarget.setCustomValidity('Nhập tên sản phẩm')}
                        onInput={(event) => event.currentTarget.setCustomValidity('')}
                        list="bouquet-options"
                        value={product.name}
                        onChange={(event) => handleProductChange(index, 'name', event.target.value)}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <datalist id="bouquet-options">
                        {bouquetOptions.map((entry) => (
                          <option key={entry.name} value={entry.name} />
                        ))}
                      </datalist>
                    </label>
                    <label className="space-y-1 text-sm font-medium text-foreground sm:w-28">
                      <span>Số lượng</span>
                      <input
                        type="number"
                        min={1}
                        value={product.quantity || ''}
                        onChange={(event) => handleProductChange(index, 'quantity', event.target.value)}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-medium text-foreground sm:w-36">
                      <span>Giá tiền</span>
                      <input
                        required
                        onInvalid={(event) => event.currentTarget.setCustomValidity('Nhập giá tiền')}
                        onInput={(event) => event.currentTarget.setCustomValidity('')}
                        inputMode="numeric"
                        placeholder="0"
                        value={product.unitPrice}
                        onChange={(event) => handleProductChange(index, 'unitPrice', event.target.value)}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                  </div>
                  <div className="space-y-2 text-xs font-medium text-foreground">
                    <div className="flex items-center justify-between">
                      <span>Ảnh mẫu</span>
                      {product.samplePhotoUrls.length > 0 && (
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {'{{count}} ảnh'.replace(
                            '{{count}}',
                            String(product.samplePhotoUrls.length),
                          )}
                        </span>
                      )}
                    </div>
                    <div
                      tabIndex={0}
                      onPaste={(event) => handleSamplePaste(index, event)}
                      className="space-y-2 rounded-lg border border-dashed border-border bg-white p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <div className="flex flex-wrap gap-2">
                        {product.samplePhotoUrls.map((photoUrl, photoIndex) => (
                          <div key={`${photoUrl}-${photoIndex}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
                            <img
                              src={thumbUrl(photoUrl)}
                              alt={`Ảnh mẫu ${photoIndex + 1}`}
                              className="h-full w-full cursor-zoom-in object-cover"
                              onClick={() => setProductPreviewUrl(photoUrl)}
                            />
                            <button
                              type="button"
                              onClick={() => removeSamplePhotoFromProduct(index, photoIndex)}
                              className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/70 text-white hover:bg-black/90"
                              aria-label="Bỏ ảnh"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[11px] font-semibold text-muted-foreground transition hover:bg-muted">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              handleSampleFiles(index, Array.from(event.target.files ?? []))
                              event.target.value = ''
                            }}
                          />
                          <ImagePlus className="h-5 w-5" />
                          Thêm ảnh
                        </label>
                      </div>
                    </div>
                  </div>
                  <label className="block space-y-1 text-xs font-medium text-foreground">
                    <span>Ghi chú sản phẩm</span>
                    <textarea
                      value={product.note || ''}
                      onChange={(event) => handleProductChange(index, 'note', event.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Hướng dẫn riêng cho sản phẩm này"
                    />
                  </label>
                  <div className="flex items-center justify-end text-xs text-muted-foreground">
                    <button
                      type="button"
                      disabled={products.length === 1}
                      onClick={() => removeProductRow(index)}
                      className="text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {productError && <p className="text-sm text-destructive">{productError}</p>}

            <button
              type="button"
              onClick={addProductRow}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-muted/50"
            >
              Thêm sản phẩm
            </button>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Thanh toán</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Tổng tiền</span>
                <input
                  readOnly
                  value={formatCurrencyFromNumber(Number(listedPrice))}
                  className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Thuế VAT %</span>
                <select
                  value={vatPercent}
                  onChange={(event) => setVatPercent(Number(event.target.value))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {[0, 5, 8, 10].map((percent) => (
                    <option key={percent} value={percent}>
                      {percent}%
                    </option>
                  ))}
                </select>
              </label>
              {!walkIn && deliveryType === 'DELIVERY' && (
                <div className="space-y-2 text-sm font-medium text-foreground">
                  <span>Phí giao hàng</span>
                  <input
                    inputMode="numeric"
                    value={freeship ? '' : deliveryFee}
                    disabled={freeship}
                    placeholder={freeship ? 'Miễn phí giao hàng' : ''}
                    onChange={(event) => setDeliveryFee(formatCurrencyInput(event.target.value))}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted/50"
                  />
                  <label className="flex items-center gap-2 font-normal">
                    <input type="checkbox" checked={freeship} onChange={(event) => setFreeship(event.target.checked)} />
                    Freeship
                  </label>
                </div>
              )}
              {!walkIn && (
              <div className="space-y-2 text-sm font-medium text-foreground">
                <label className="block space-y-2">
                  <span>Tiền cọc</span>
                  <input
                    inputMode="numeric"
                    value={paidInFull ? formatCurrencyInput(String(orderTotalValue)) : deposit}
                    disabled={paidInFull}
                    onChange={(event) => setDeposit(formatCurrencyInput(event.target.value))}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted/50"
                  />
                </label>
                <label className="flex items-center gap-2 font-normal">
                  <input type="checkbox" checked={paidInFull} onChange={(event) => setPaidInFull(event.target.checked)} />
                  Khách đã thanh toán đủ
                </label>
              </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1 rounded-xl bg-muted/60 px-4 py-3">
              <span className="text-sm text-muted-foreground">{walkIn ? 'Khách trả' : 'Khách phải trả'}</span>
              <span className="text-2xl font-bold text-foreground">{formattedOrderTotal}</span>
              {walkIn ? (
                <span className="text-sm font-medium text-green-700">Đã thanh toán đủ · đã giao</span>
              ) : paidInFull ? (
                <span className="text-sm font-medium text-green-700">Đã thanh toán đủ</span>
              ) : parseCurrencyToNumber(deposit) > 0 && (
                <span className="text-sm text-muted-foreground">Còn phải thu: {formattedRemainingBalance}</span>
              )}
            </div>
          </section>

          {submitError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
          )}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link
              href={`/${lang}/orders`}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
            >
              Quay lại đơn hàng
            </Link>
            <button
              type="submit"
              disabled={isSaving || uploading > 0}
              className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploading > 0 ? 'Đang tải ảnh…' : isSaving ? 'Đang tạo…' : walkIn ? 'Lưu đơn bán tại cửa hàng' : 'Tạo đơn'}
            </button>
          </div>
        </form >
        {productPreviewUrl && (() => {
          const photos = products.find((product) => product.samplePhotoUrls.includes(productPreviewUrl))?.samplePhotoUrls ?? [productPreviewUrl]
          return (
            <PhotoViewer
              photos={photos}
              startIndex={Math.max(0, photos.indexOf(productPreviewUrl))}
              onClose={() => setProductPreviewUrl(null)}
            />
          )
        })()}
      </div >
    )
  )
}
