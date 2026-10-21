-- Shift date, correction tracking and one-shift-per-day for check-ins.
ALTER TABLE "StaffCheckIn"
  ADD COLUMN "workDate" TEXT,
  ADD COLUMN "autoClosed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "correctedAt" TIMESTAMP(3),
  ADD COLUMN "correctedById" TEXT,
  ADD COLUMN "correctedByName" TEXT,
  ADD COLUMN "correctionReason" TEXT;

-- Existing rows: the Vietnam date of the check-in (timestamps are stored as UTC).
UPDATE "StaffCheckIn"
SET "workDate" = to_char(COALESCE("checkInAt", "timestamp") + interval '7 hours', 'YYYY-MM-DD');

ALTER TABLE "StaffCheckIn" ALTER COLUMN "workDate" SET NOT NULL;

-- If two check-ins already exist for one person on one day this fails, the
-- build stops and the previous deployment keeps running; merge them by hand.
CREATE UNIQUE INDEX "StaffCheckIn_staffId_workDate_key" ON "StaffCheckIn"("staffId", "workDate");

CREATE TABLE "ShopSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "openTime" TEXT NOT NULL DEFAULT '08:00',
    "closeTime" TEXT NOT NULL DEFAULT '19:00',
    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "ShopSettings" ("id") VALUES (1);
