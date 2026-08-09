-- AlterTable
ALTER TABLE "AdminInvite" ADD COLUMN     "maxUses" INTEGER DEFAULT 1,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "useCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AdminInviteRedemption" (
    "id" SERIAL NOT NULL,
    "inviteId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInviteRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminInviteRedemption_adminId_key" ON "AdminInviteRedemption"("adminId");

-- CreateIndex
CREATE INDEX "AdminInviteRedemption_inviteId_idx" ON "AdminInviteRedemption"("inviteId");

-- AddForeignKey
ALTER TABLE "AdminInviteRedemption" ADD CONSTRAINT "AdminInviteRedemption_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "AdminInvite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInviteRedemption" ADD CONSTRAINT "AdminInviteRedemption_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
