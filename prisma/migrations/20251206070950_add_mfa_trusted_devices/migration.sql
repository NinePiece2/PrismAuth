-- CreateTable
CREATE TABLE "MfaTrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceIdentifier" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaTrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaTrustedDevice_userId_idx" ON "MfaTrustedDevice"("userId");

-- CreateIndex
CREATE INDEX "MfaTrustedDevice_deviceIdentifier_idx" ON "MfaTrustedDevice"("deviceIdentifier");

-- CreateIndex
CREATE INDEX "MfaTrustedDevice_expiresAt_idx" ON "MfaTrustedDevice"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaTrustedDevice_userId_deviceIdentifier_key" ON "MfaTrustedDevice"("userId", "deviceIdentifier");

-- AddForeignKey
ALTER TABLE "MfaTrustedDevice" ADD CONSTRAINT "MfaTrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
