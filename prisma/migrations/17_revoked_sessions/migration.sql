-- Signing out revokes one device's session (an account may be shared), not
-- every session of the account.
CREATE TABLE "RevokedSession" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevokedSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RevokedSession_expiresAt_idx" ON "RevokedSession"("expiresAt");
