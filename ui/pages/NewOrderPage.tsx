'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/providers/locale-provider'
import { useAppData } from '@/components/providers/app-data-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { fileToDataUrl, formatCurrencyFromNumber, formatCurrencyInput, parseCurrencyToNumber } from '@/lib/utils'

const normalizePhone = (value: string) => value.replace(/\D/g, '')

type ProductForm = {
  name: string
  quantity: number
  note?: string
  samplePhotoUrls: string[]
  draftSampleUrl?: string
}

export default function NewOrderPage() {
  const router = useRouter()
  const { lang, t, getDeliveryLabel } = useLocale()
  const { createOrder, createTask, orders, florists } = useAppData()
  const { user } = useAuth()

  const [customerName, setCustomerName] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [listedPrice, setListedPrice] = useState('')
  const [discount, setDiscount] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [deliveryCoveredByShop, setDeliveryCoveredByShop] = useState(false)
  const [vatPercent, setVatPercent] = useState<number>(10)
  const [deposit, setDeposit] = useState('')
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [receiveTime, setReceiveTime] = useState(() => new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [products, setProducts] = useState<ProductForm[]>([
    { name: '', quantity: 1, note: '', samplePhotoUrls: [], draftSampleUrl: '' },
  ])
  const [customerNameLocked, setCustomerNameLocked] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)
  const [productPreviewUrl, setProductPreviewUrl] = useState<string | null>(null)

  const existingCustomers = useMemo(() => {
    const registry = new Map<string, { phone: string; name: string }>()
    orders.forEach((order) => {
      const key = normalizePhone(order.customerPhone)
      if (key && !registry.has(key)) {
        registry.set(key, { phone: order.customerPhone, name: order.customerName })
      }
    })
    return Array.from(registry.values())
  }, [orders])

  useEffect(() => {
    if (!customerPhone) {
      setCustomerNameLocked(false)
      return
    }
    const match = existingCustomers.find((entry) => normalizePhone(entry.phone) === normalizePhone(customerPhone))
    if (match) {
      setCustomerName(match.name)
      setCustomerNameLocked(true)
    } else if (customerNameLocked) {
      setCustomerName('')
      setCustomerNameLocked(false)
    }
  }, [customerPhone, existingCustomers, customerNameLocked])

  const isNewCustomer = useMemo(
    () => !existingCustomers.some((entry) => normalizePhone(entry.phone) === normalizePhone(customerPhone)),
    [customerPhone, existingCustomers],
  )

  const dueTimeForTasks = useMemo(() => {
    const receiveDate = new Date(receiveTime)
    return new Date(receiveDate.getTime() - 1000 * 60 * 120).toISOString()
  }, [receiveTime])

  const {
    formattedSellingPrice,
    formattedOrderTotal,
    formattedRemainingBalance,
  } = useMemo(() => {
    const listedAmount = parseCurrencyToNumber(listedPrice)
    const discountAmount = parseCurrencyToNumber(discount)
    const deliveryAmount = parseCurrencyToNumber(deliveryFee)
    const depositAmount = parseCurrencyToNumber(deposit)
    const vatRate = Number.isFinite(vatPercent) ? vatPercent : 0

    const basePriceValue = Math.max(listedAmount - discountAmount, 0)
    const vatAmount = Math.round((basePriceValue * vatRate) / 100)
    const sellingPriceValue = basePriceValue + vatAmount
    const deliveryChargeValue = deliveryCoveredByShop ? 0 : deliveryAmount
    const orderTotalValue = sellingPriceValue + deliveryChargeValue
    const remainingBalanceValue = Math.max(orderTotalValue - depositAmount, 0)

    return {
      formattedSellingPrice: formatCurrencyFromNumber(sellingPriceValue),
      formattedOrderTotal: formatCurrencyFromNumber(orderTotalValue),
      formattedRemainingBalance: formatCurrencyFromNumber(remainingBalanceValue),
    }
  }, [deliveryCoveredByShop, deliveryFee, deposit, discount, listedPrice, vatPercent])

  const bouquetOptions = useMemo(() => {
    const registry = new Map<string, string | undefined>()
    orders.forEach((order) => {
      if (!registry.has(order.bouquetName)) {
        registry.set(order.bouquetName, order.bouquetImage)
      }
    })
    return Array.from(registry.entries()).map(([name, image]) => ({ name, image }))
  }, [orders])

  const handleProductChange = (index: number, key: 'name' | 'quantity' | 'note', value: string | number) => {
    setProducts((prev) =>
      prev.map((product, idx) => {
        if (idx !== index) return product
        if (key === 'quantity') {
          return { ...product, quantity: Number(value) }
        }
        if (key === 'name') {
          return { ...product, name: String(value) }
        }
        return { ...product, note: String(value) }
      }),
    )
  }

  const setDraftSampleUrl = (index: number, value: string) => {
    setProducts((prev) => prev.map((product, idx) => (idx === index ? { ...product, draftSampleUrl: value } : product)))
  }

  const addSamplePhotoToProduct = (index: number, url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setProducts((prev) =>
      prev.map((product, idx) =>
        idx === index
          ? { ...product, samplePhotoUrls: [...product.samplePhotoUrls, trimmed], draftSampleUrl: '' }
          : product,
      ),
    )
    setProductPreviewUrl(trimmed)
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

  const handleSampleFileUpload = async (index: number, fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    addSamplePhotoToProduct(index, dataUrl)
  }

  const addProductRow = () => {
    setProducts((prev) => [...prev, { name: '', quantity: 1, note: '', samplePhotoUrls: [], draftSampleUrl: '' }])
  }

  const removeProductRow = (index: number) => {
    setProducts((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setProductError(null)

    const preparedProducts = products.filter((product) => product.name.trim())
    if (preparedProducts.length === 0) {
      setProductError(t('orders.new.taskValidation', 'Please enter a name for each item.'))
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
        receiverName,
        receiverPhone,
        bouquetName: primaryProduct.name,
        bouquetImage: primaryProduct.samplePhotoUrls[0] || matched?.image,
        deliveryType,
        deliveryAddress: deliveryType === 'DELIVERY' ? deliveryAddress : undefined,
        receiveTime: new Date(receiveTime).toISOString(),
        status: 'NEW',
        listedPrice,
        discount,
        deliveryFee,
        deliveryCoveredByShop,
        vatPercent,
        deposit,
        sellingPrice: formattedSellingPrice,
        remainingBalance: formattedRemainingBalance,
        total: formattedOrderTotal,
        notes,
        createdById: user?.id,
        createdByName: user?.name,
        new_customer: isNewCustomer,
        assigneeId: assigneeId || undefined,
        assigneeName: florists.find((f) => f.id === assigneeId)?.name || undefined,
        products: preparedProducts.map((product) => ({
          name: product.name,
          quantity: product.quantity,
          note: product.note,
          samplePhotoUrls: product.samplePhotoUrls,
        })),
      })

      await Promise.all(
        preparedProducts.map((product) => {
          const match = bouquetOptions.find(
            (option) => option.name.toLowerCase() === product.name.toLowerCase(),
          )
          return createTask({
            orderId: created.id,
            bouquetName: product.name,
            bouquetImage: product.samplePhotoUrls[0] || match?.image,
            samplePhotoUrls: product.samplePhotoUrls,
            dueTime: dueTimeForTasks,
            status: 'UNASSIGNED',
            notes: [product.note, notes].filter(Boolean).join('\n'),
            taskTitle: `${product.quantity} × Arrange ${product.name}`,
            quantity: product.quantity,
            type: 'CAM_HOA',
          })
        }),
      )
      router.push(`/${lang}/orders/${created.id}`)
    } catch (error) {
      console.error('Failed to create order', error)
      setIsSaving(false)
    }
  }

  return (
    user?.role === 'florist' ? (
      <div className="space-y-4 p-4 md:p-8">
        <Link href={`/${lang}/orders`} className="inline-flex items-center gap-2 text-sm text-primary">
          {t('orders.detail.back')}
        </Link>
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          {t('orders.floristWarning')}
        </div>
      </div>
    ) : (
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('orders.heroSubtitle')}</p>
            <h1 className="text-3xl font-bold text-foreground">{t('orders.new.title', 'New order')}</h1>
            <p className="text-muted-foreground">{t('orders.new.subtitle', 'Capture order basics to dispatch tasks quickly.')}</p>
          </div>
          <Link
            href={`/${lang}/orders`}
            className="hidden rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted md:inline-block"
          >
            {t('orders.detail.back')}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{t('orders.new.orderInfo', 'Order info')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('orders.new.orderInfoHint', 'Capture who is buying, who is receiving, and when it is needed.')}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.customerPhone', 'Customer phone')}</span>
                <input
                  required
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  list="customer-phone-options"
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <datalist id="customer-phone-options">
                  {existingCustomers.map((entry) => (
                    <option key={entry.phone} value={entry.phone}>
                      {entry.name}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.customerName', 'Customer name')}</span>
                <input
                  required
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  disabled={customerNameLocked}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/50"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.receiverName', 'Receiver name')}</span>
                <input
                  required
                  value={receiverName}
                  onChange={(event) => setReceiverName(event.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.receiverPhone', 'Receiver phone')}</span>
                <input
                  required
                  value={receiverPhone}
                  onChange={(event) => setReceiverPhone(event.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.deliveryType', 'Delivery type')}</span>
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
                  <span>{t('orders.new.deliveryAddress', 'Delivery Address')}</span>
                  <input
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder={t('orders.new.deliveryAddressPlaceholder', 'House number, street...')}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              )}
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.receiveTime', 'Ready by')}</span>
                <input
                  type="datetime-local"
                  value={receiveTime}
                  onChange={(event) => setReceiveTime(event.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>{t('orders.new.notes', 'Notes')}</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('orders.new.notesPlaceholder', 'Delivery instructions, card message, etc.')}
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>{t('orders.assignee', 'Phân công Florist')} ({t('common.optional', 'Tuỳ chọn')})</span>
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t('common.select', 'Select')}</option>
                {florists.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </section >

          <section className="space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">{t('orders.new.taskListTitle', 'Products for this order')}</h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  'orders.new.taskListSubtitle',
                  'Add products. Each item will create an arranging task and can include an inspiration photo.',
                )}
              </p>
            </div>
            <div className="space-y-3">
              {products.map((product, index) => (
                <div key={`product-${index}`} className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex-1 space-y-1 text-sm font-medium text-foreground">
                      <span>{t('orders.new.productLabel', 'Order product')}</span>
                      <input
                        required
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
                    <label className="w-28 space-y-1 text-sm font-medium text-foreground">
                      <span>{t('orders.new.quantityLabel', 'Qty')}</span>
                      <input
                        type="number"
                        min={1}
                        value={product.quantity}
                        onChange={(event) => handleProductChange(index, 'quantity', Number(event.target.value) || 1)}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                  </div>
                  <div className="space-y-2 text-xs font-medium text-foreground">
                    <div className="flex items-center justify-between">
                      <span>{t('orders.new.samplePhoto', 'Sample photos')}</span>
                      {product.samplePhotoUrls.length > 0 && (
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {t('orders.new.samplePhotoCount', '{{count}} photo(s)').replace(
                            '{{count}}',
                            String(product.samplePhotoUrls.length),
                          )}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 rounded-lg border border-border bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={product.draftSampleUrl || ''}
                          onChange={(event) => setDraftSampleUrl(index, event.target.value)}
                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={t('orders.new.samplePhotoPlaceholder', 'Paste one or more inspiration image URLs')}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addSamplePhotoToProduct(index, product.draftSampleUrl || '')}
                            className="flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                          >
                            {t('orders.new.addSamplePhoto', 'Add photo')}
                          </button>
                          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => handleSampleFileUpload(index, event.target.files)}
                            />
                            {t('orders.new.uploadSample', 'Upload')}
                          </label>
                        </div>
                      </div>
                      {product.samplePhotoUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {product.samplePhotoUrls.map((photoUrl, photoIndex) => (
                            <div key={`${photoUrl}-${photoIndex}`} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
                              <img
                                src={photoUrl}
                                alt={t('orders.new.samplePhotoAlt', 'Sample arrangement inspiration')}
                                className="h-full w-full object-cover"
                                onClick={() => setProductPreviewUrl(photoUrl)}
                              />
                              <button
                                type="button"
                                onClick={() => removeSamplePhotoFromProduct(index, photoIndex)}
                                className="absolute right-1 top-1 hidden h-6 w-6 rounded-full bg-black/70 text-white hover:bg-black/90 group-hover:block"
                                aria-label={t('orders.new.removeSamplePhoto', 'Remove photo')}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {t('orders.new.samplePhotoHint', 'Attach multiple inspiration photos for florists to reference.')}
                      </p>
                    </div>
                  </div>
                  <label className="block space-y-1 text-xs font-medium text-foreground">
                    <span>{t('orders.new.productNote', 'Product note')}</span>
                    <textarea
                      value={product.note || ''}
                      onChange={(event) => handleProductChange(index, 'note', event.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={t('orders.new.productNotePlaceholder', 'Specific instructions for this product')}
                    />
                  </label>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                      {t('orders.new.arrangingBadge', 'Will create arranging task')}
                    </span>
                    <button
                      type="button"
                      disabled={products.length === 1}
                      onClick={() => removeProductRow(index)}
                      className="text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('orders.new.removeTask', 'Remove')}
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
              {t('orders.new.addTask', 'Add another task')}
            </button>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{t('orders.new.paymentInfo', 'Payment info')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('orders.new.paymentInfoHint', 'Log pricing, fees, and how much remains to collect.')}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.listedPrice', 'Listed price')}</span>
                <input
                  required
                  inputMode="numeric"
                  value={listedPrice}
                  onChange={(event) => setListedPrice(formatCurrencyInput(event.target.value))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.discount', 'Discount')}</span>
                <input
                  inputMode="numeric"
                  value={discount}
                  onChange={(event) => setDiscount(formatCurrencyInput(event.target.value))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.deliveryFee', 'Delivery fee')}</span>
                <input
                  inputMode="numeric"
                  value={deliveryFee}
                  onChange={(event) => setDeliveryFee(formatCurrencyInput(event.target.value))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <div className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.deliveryCoveredByShop', 'Delivery covered by shop?')}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryCoveredByShop(false)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${!deliveryCoveredByShop ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-foreground'
                      }`}
                  >
                    {t('orders.new.deliveryCustomerPays', 'Customer pays')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryCoveredByShop(true)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${deliveryCoveredByShop ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-foreground'
                      }`}
                  >
                    {t('orders.new.deliveryShopCovers', 'Shop covers')}
                  </button>
                </div>
              </div>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.vatPercent', 'VAT %')}</span>
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
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.deposit', 'Deposit')}</span>
                <input
                  inputMode="numeric"
                  value={deposit}
                  onChange={(event) => setDeposit(formatCurrencyInput(event.target.value))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.sellingPrice', 'Selling price')}</span>
                <input
                  readOnly
                  value={formattedSellingPrice}
                  className="w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.orderTotalValue', 'Order total value')}</span>
                <input
                  readOnly
                  value={formattedOrderTotal}
                  className="w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>{t('orders.new.remainingBalance', 'Remaining to pay')}</span>
                <input
                  readOnly
                  value={formattedRemainingBalance}
                  className="w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
          </section>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link
              href={`/${lang}/orders`}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
            >
              {t('orders.detail.back')}
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? t('orders.new.saving', 'Saving...') : t('orders.new.submit', 'Create order')}
            </button>
          </div>
        </form >
        {productPreviewUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setProductPreviewUrl(null)}
          >
            <div className="relative w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setProductPreviewUrl(null)}
                className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label={t('orders.new.closePreview', 'Close preview')}
              >
                <span className="text-lg leading-none">×</span>
              </button>
              <img
                src={productPreviewUrl}
                alt={t('orders.new.samplePhotoAlt', 'Sample arrangement inspiration')}
                className="max-h-[80vh] w-full rounded-2xl object-contain shadow-2xl"
              />
            </div>
          </div>
        )
        }
      </div >
    )
  )
}
