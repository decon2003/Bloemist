-- Sales may work part of a day "online" (from home) at a lower hourly rate:
-- a day can have one shift at the shop and one online.
ALTER TABLE "StaffCheckIn" ADD COLUMN "workMode" TEXT NOT NULL DEFAULT 'SHOP';
DROP INDEX "StaffCheckIn_staffId_workDate_key";
CREATE UNIQUE INDEX "StaffCheckIn_staffId_workDate_workMode_key" ON "StaffCheckIn"("staffId", "workDate", "workMode");

-- Hourly rate for online (at-home) shifts; null = the normal hourly rate.
ALTER TABLE "User" ADD COLUMN "onlineHourlyRate" INTEGER;
ALTER TABLE "PayrollLine" ADD COLUMN "onlineHourlyRate" INTEGER;
