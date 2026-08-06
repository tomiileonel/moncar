-- CreateTable
CREATE TABLE `AdminInvite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'MECHANIC') NOT NULL DEFAULT 'MECHANIC',
    `issuedById` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminInvite_token_key`(`token`),
    INDEX `AdminInvite_token_idx`(`token`),
    INDEX `AdminInvite_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminInvite` ADD CONSTRAINT `AdminInvite_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `Admin`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
