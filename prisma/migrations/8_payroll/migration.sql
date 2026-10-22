-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "otMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockedByName" TEXT,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "payType" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL DEFAULT 0,
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
    "makerRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "referralRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shifts" JSONB NOT NULL DEFAULT '[]',
    "commissions" JSONB NOT NULL DEFAULT '[]',
    "adjustments" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_month_key" ON "Payroll"("month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLine_payrollId_userId_key" ON "PayrollLine"("payrollId", "userId");

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

