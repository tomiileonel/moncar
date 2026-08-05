-- AlterTable
ALTER TABLE `admin` ADD COLUMN `role` ENUM('OWNER', 'MECHANIC') NOT NULL DEFAULT 'MECHANIC';

-- AlterTable
ALTER TABLE `vehicle` MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `Vehicle_deleted_status_idx` ON `Vehicle`(`deleted`, `status`);

-- CreateIndex
CREATE INDEX `Vehicle_entry_idx` ON `Vehicle`(`entry`);
