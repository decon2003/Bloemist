-- Failed sign-ins per client IP (throttles password spraying across accounts).
CREATE TABLE "LoginFailure" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginFailure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginFailure_ip_at_idx" ON "LoginFailure"("ip", "at");
