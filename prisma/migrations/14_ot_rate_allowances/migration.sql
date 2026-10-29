-- Overtime is paid at a fixed rate per person (null = hourly rate x the OT
-- multiplier), and fixed monthly allowances (meals, fuel...) are part of the
-- pay profile, copied into each month's line.
ALTER TABLE "User" ADD COLUMN "otHourlyRate" INTEGER;
ALTER TABLE "User" ADD COLUMN "allowances" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "PayrollLine" ADD COLUMN "otHourlyRate" INTEGER;
ALTER TABLE "PayrollLine" ADD COLUMN "allowances" JSONB NOT NULL DEFAULT '[]';
