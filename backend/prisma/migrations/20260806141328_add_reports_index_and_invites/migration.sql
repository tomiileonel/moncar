-- DropIndex
DROP INDEX `AdminInvite_issuedById_fkey` ON `admininvite`;

-- CreateIndex
CREATE INDEX `Vehicle_deleted_status_entry_idx` ON `Vehicle`(`deleted`, `status`, `entry`);

-- AddForeignKey
ALTER TABLE `AdminInvite` ADD CONSTRAINT `AdminInvite_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `Admin`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
