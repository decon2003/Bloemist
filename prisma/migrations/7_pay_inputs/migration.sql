-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hourlyRate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payType" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "referralCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "salesCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "referrerId" TEXT,
ADD COLUMN     "referrerName" TEXT;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "otMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5;


-- Sales staff are paid by the hour plus a share of the orders they sell. Their
-- old commissionRate meant "% of orders sold"; it now means "% of products made".
UPDATE "User"
SET "salesCommissionRate" = COALESCE("commissionRate", 0),
    "commissionRate" = 0,
    "payType" = 'HOURLY'
WHERE "role" = 'sales';
