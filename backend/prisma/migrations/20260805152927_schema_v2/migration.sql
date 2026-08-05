-- CreateTable
CREATE TABLE `Admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Admin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `owner` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `type` ENUM('AUTO', 'CAMIONETA', 'CAMION') NOT NULL DEFAULT 'AUTO',
    `carname` VARCHAR(191) NOT NULL,
    `year` INTEGER NULL,
    `km` INTEGER NULL,
    `entry` DATETIME(3) NOT NULL,
    `exit` DATETIME(3) NULL,
    `problem` TEXT NOT NULL,
    `cost_labor` DECIMAL(12, 2) NULL,
    `cost_parts` DECIMAL(12, 2) NULL,
    `status` ENUM('PENDIENTE', 'EN_REPARACION', 'LISTO') NOT NULL DEFAULT 'PENDIENTE',
    `source` ENUM('CLIENT', 'ADMIN') NOT NULL DEFAULT 'CLIENT',
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
