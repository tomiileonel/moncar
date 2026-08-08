-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('PENDIENTE', 'EN_REPARACION', 'LISTO');

-- CreateEnum
CREATE TYPE "VehicleSource" AS ENUM ('CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('AUTO', 'CAMIONETA', 'CAMION');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'MECHANIC');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WEBHOOK', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MECHANIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminInvite" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MECHANIC',
    "issuedById" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "owner" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'AUTO',
    "carname" TEXT NOT NULL,
    "year" INTEGER,
    "km" INTEGER,
    "entry" TIMESTAMP(3) NOT NULL,
    "exit" TIMESTAMP(3),
    "problem" TEXT NOT NULL,
    "cost_labor" DECIMAL(12,2),
    "cost_parts" DECIMAL(12,2),
    "status" "VehicleStatus" NOT NULL DEFAULT 'PENDIENTE',
    "source" "VehicleSource" NOT NULL DEFAULT 'CLIENT',
    "plate" VARCHAR(12),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "vehicleId" INTEGER,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePart" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" VARCHAR(32) NOT NULL,
    "message" TEXT NOT NULL,
    "providerResponse" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvite_token_key" ON "AdminInvite"("token");

-- CreateIndex
CREATE INDEX "AdminInvite_token_idx" ON "AdminInvite"("token");

-- CreateIndex
CREATE INDEX "AdminInvite_expiresAt_idx" ON "AdminInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "Vehicle_deleted_status_idx" ON "Vehicle"("deleted", "status");

-- CreateIndex
CREATE INDEX "Vehicle_entry_idx" ON "Vehicle"("entry");

-- CreateIndex
CREATE INDEX "Vehicle_plate_phone_idx" ON "Vehicle"("plate", "phone");

-- CreateIndex
CREATE INDEX "Vehicle_deleted_status_entry_idx" ON "Vehicle"("deleted", "status", "entry");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE INDEX "InventoryItem_active_quantity_idx" ON "InventoryItem"("active", "quantity");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_vehicleId_idx" ON "StockMovement"("vehicleId");

-- CreateIndex
CREATE INDEX "VehiclePart_itemId_idx" ON "VehiclePart"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePart_vehicleId_itemId_key" ON "VehiclePart"("vehicleId", "itemId");

-- CreateIndex
CREATE INDEX "Notification_vehicleId_createdAt_idx" ON "Notification"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePart" ADD CONSTRAINT "VehiclePart_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePart" ADD CONSTRAINT "VehiclePart_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
