-- Money customers paid for an order, one row per transfer. Sales KPI is paid
-- per shift from the payments that arrived in it.
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "recordedByName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");
CREATE INDEX "OrderPayment_paidAt_idx" ON "OrderPayment"("paidAt");
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deposits taken so far become each order's first payment, at the time the
-- order was created (sales create the order once the customer has paid).
INSERT INTO "OrderPayment" ("id", "orderId", "amount", "paidAt", "recordedById", "recordedByName", "note", "createdAt")
SELECT gen_random_uuid()::text, "id", "deposit", "createdAt", "createdById", "createdByName", 'Tiền cọc khi tạo đơn', "createdAt"
FROM "Order"
WHERE "deposit" > 0;

-- KPI shifts and tiers ('' = the built-in defaults), and each month's KPI items.
ALTER TABLE "ShopSettings" ADD COLUMN "kpiShifts" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopSettings" ADD COLUMN "kpiTiers" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PayrollLine" ADD COLUMN "kpi" JSONB NOT NULL DEFAULT '[]';
