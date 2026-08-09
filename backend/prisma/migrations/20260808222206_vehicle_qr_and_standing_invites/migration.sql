-- AlterTable
ALTER TABLE "AdminInvite" ADD COLUMN     "standing" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VehicleQrToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "VehicleQrToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleQrToken_token_key" ON "VehicleQrToken"("token");

-- CreateIndex
CREATE INDEX "VehicleQrToken_plate_revokedAt_idx" ON "VehicleQrToken"("plate", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminInvite_usedAt_idx" ON "AdminInvite"("usedAt");
