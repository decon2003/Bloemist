"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAppData } from "@/components/providers/app-data-provider"
import { useLocale } from "@/components/providers/locale-provider"

export default function CreateOrderForm() {
  const router = useRouter()
  const { lang, t, getDeliveryLabel } = useLocale()
  const { createTask } = useAppData()

  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerSocial, setCustomerSocial] = useState("")
  const [socialPlatform, setSocialPlatform] = useState<"zalo" | "facebook" | "instagram">("zalo")

  const [receiverName, setReceiverName] = useState("")
  const [receiverPhone, setReceiverPhone] = useState("")

  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiveTime, setReceiveTime] = useState("14:00")
  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "PICKUP">("DELIVERY")
  const [address, setAddress] = useState("")

  const [cardMessage, setCardMessage] = useState("")
  const [bouquetName, setBouquetName] = useState("")
  const [depositAmount, setDepositAmount] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!customerPhone || !bouquetName || !receiveDate || !receiveTime) return

    try {
      setIsSubmitting(true)
      // Simulate order creation - in a real app, this would call an API
      const newOrderId = `ORD-${Date.now()}`
      const receiveDateTime = new Date(`${receiveDate}T${receiveTime}`).toISOString()

      // Create the main task for this order
      await createTask({
        orderId: newOrderId,
        bouquetName,
        dueTime: receiveDateTime,
        status: "ASSIGNED",
        notes: cardMessage || "",
        taskTitle: `Build ${bouquetName}`,
      })

      router.push(`/${lang}/orders/${newOrderId}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => router.back()} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
            ← {t("common.back", "Back")}
          </button>
          <h1 className="text-4xl font-bold text-foreground">{t("orders.create.title", "Create New Order")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("orders.create.subtitle", "Fill in the details below to create a new order")}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Customer Information Section */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              {t("orders.create.customer", "Customer Information")}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("orders.create.customerName", "Customer Name")} *
                  </label>
                  <input
                    required
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("orders.create.customerPhone", "Phone")} *
                  </label>
                  <input
                    required
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t("orders.create.socialLink", "Social Link")}
                </label>
                <div className="flex gap-2">
                  <select
                    value={socialPlatform}
                    onChange={(e) => setSocialPlatform(e.target.value as any)}
                    className="w-24 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="zalo">Zalo</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                  </select>
                  <input
                    type="text"
                    value={customerSocial}
                    onChange={(e) => setCustomerSocial(e.target.value)}
                    placeholder="Social handle or link"
                    className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Receiver Information Section */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              {t("orders.create.receiver", "Receiver Information")}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("orders.create.receiverName", "Receiver Name")}
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("orders.create.receiverPhone", "Receiver Phone")}
                  </label>
                  <input
                    type="tel"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Delivery Information Section */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              {t("orders.create.delivery", "Delivery Information")}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("orders.create.receiveDate", "Receive Date")} *
                  </label>
                  <input
                    required
                    type="date"
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("orders.create.receiveTime", "Receive Time")} *
                  </label>
                  <input
                    required
                    type="time"
                    value={receiveTime}
                    onChange={(e) => setReceiveTime(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t("orders.create.deliveryType", "Delivery Type")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="DELIVERY"
                      checked={deliveryType === "DELIVERY"}
                      onChange={(e) => setDeliveryType(e.target.value as "DELIVERY" | "PICKUP")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{getDeliveryLabel("DELIVERY")}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="PICKUP"
                      checked={deliveryType === "PICKUP"}
                      onChange={(e) => setDeliveryType(e.target.value as "DELIVERY" | "PICKUP")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{getDeliveryLabel("PICKUP")}</span>
                  </label>
                </div>
              </div>

              {deliveryType === "DELIVERY" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("orders.create.address", "Delivery Address")}
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter delivery address"
                    rows={3}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Bouquet & Message Section */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              {t("orders.create.product", "Bouquet & Message")}
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t("orders.create.bouquetName", "Main Bouquet/Product")} *
                </label>
                <input
                  required
                  type="text"
                  value={bouquetName}
                  onChange={(e) => setBouquetName(e.target.value)}
                  placeholder="e.g., Red Rose Premium Bouquet"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t("orders.create.cardMessage", "Card Message")}
                </label>
                <textarea
                  value={cardMessage}
                  onChange={(e) => setCardMessage(e.target.value)}
                  placeholder="Enter a message to include with the bouquet"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t("orders.create.deposit", "Deposit Amount")}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Form Actions */}
          <div className="flex gap-3 pb-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted md:flex-none md:px-8"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !customerPhone || !bouquetName || !receiveDate || !receiveTime}
              className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 md:flex-none md:px-8"
            >
              {isSubmitting ? t("common.creating", "Creating...") : t("orders.create.submit", "Create Order")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
