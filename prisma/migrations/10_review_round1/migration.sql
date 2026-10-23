-- Review round 1 (2026-10-23), decisions by the owner.

-- Discounts are no longer used at all (no order carried one).
ALTER TABLE "Order" DROP COLUMN "discount";

-- "Tạo đơn" sends a one-off id; a retried request returns the order the first
-- attempt created instead of creating a duplicate.
ALTER TABLE "Order" ADD COLUMN "requestId" TEXT;
CREATE UNIQUE INDEX "Order_requestId_key" ON "Order"("requestId");

-- Pay profile: hourly rate on public holidays (assistants; blank = normal
-- rate) and paid days off per month (monthly staff; base salary is paid per
-- day worked out of days-in-month minus these).
ALTER TABLE "User" ADD COLUMN "holidayHourlyRate" INTEGER;
ALTER TABLE "User" ADD COLUMN "daysOffPerMonth" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "PayrollLine" ADD COLUMN "holidayHourlyRate" INTEGER;
ALTER TABLE "PayrollLine" ADD COLUMN "daysOffPerMonth" INTEGER NOT NULL DEFAULT 4;

-- A draft line follows the person's pay profile on every refresh unless a
-- manager set this month's rates by hand. Lines already edited away from the
-- profile keep their rates.
ALTER TABLE "PayrollLine" ADD COLUMN "ratesOverridden" BOOLEAN NOT NULL DEFAULT false;
UPDATE "PayrollLine" l
SET "ratesOverridden" = true
FROM "User" u
WHERE u."id" = l."userId"
  AND (l."payType" <> u."payType"
    OR l."baseSalary" <> COALESCE(u."baseSalary", 0)
    OR l."hourlyRate" <> u."hourlyRate"
    OR l."makerRate" <> COALESCE(u."commissionRate", 0)
    OR l."salesRate" <> u."salesCommissionRate");

-- Public holidays: JSON list of {"date":"YYYY-MM-DD","name":"..."}.
ALTER TABLE "ShopSettings" ADD COLUMN "holidays" TEXT NOT NULL DEFAULT '[]';
