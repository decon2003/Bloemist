-- The shop has two commissions: sales and making. "Referrer" was the person
-- who brought the order in, which is the salesperson - rename it (keeping the
-- data) and drop the separate referral rate.
ALTER TABLE "Order" RENAME COLUMN "referrerId" TO "salespersonId";
ALTER TABLE "Order" RENAME COLUMN "referrerName" TO "salespersonName";

-- Orders without one keep crediting their creator, as before.
UPDATE "Order"
SET "salespersonId" = "createdById", "salespersonName" = "createdByName"
WHERE "salespersonId" IS NULL AND "createdById" IS NOT NULL;

ALTER TABLE "User" DROP COLUMN "referralCommissionRate";
ALTER TABLE "PayrollLine" DROP COLUMN "referralRate";
