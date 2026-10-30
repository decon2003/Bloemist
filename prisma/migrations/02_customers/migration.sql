-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "source" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: one customer per normalised phone from existing orders, named after
-- their most recent order. Must match normalizeCustomerPhone() in
-- lib/server/customers.ts (digits only; 84xxxxxxxxx -> 0xxxxxxxxx).
WITH normalised AS (
    SELECT
        o."id",
        o."customerName",
        o."createdAt",
        CASE
            WHEN regexp_replace(o."customerPhone", '\D', '', 'g') ~ '^84[0-9]{9}$'
                THEN '0' || substr(regexp_replace(o."customerPhone", '\D', '', 'g'), 3)
            ELSE regexp_replace(o."customerPhone", '\D', '', 'g')
        END AS phone
    FROM "Order" o
)
INSERT INTO "Customer" ("id", "phone", "name", "createdAt", "updatedAt")
SELECT DISTINCT ON (phone) gen_random_uuid()::text, phone, "customerName", "createdAt", CURRENT_TIMESTAMP
FROM normalised
WHERE phone <> ''
ORDER BY phone, "createdAt" DESC;

UPDATE "Order" o
SET "customerId" = c."id"
FROM "Customer" c
WHERE c."phone" = CASE
        WHEN regexp_replace(o."customerPhone", '\D', '', 'g') ~ '^84[0-9]{9}$'
            THEN '0' || substr(regexp_replace(o."customerPhone", '\D', '', 'g'), 3)
        ELSE regexp_replace(o."customerPhone", '\D', '', 'g')
    END;
