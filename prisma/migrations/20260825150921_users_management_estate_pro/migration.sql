-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `fk_audit_logs_actor_user`;

-- DropForeignKey
ALTER TABLE `authentication_user_two_factor_challenges` DROP FOREIGN KEY `auth_u2f_challenge_user_fk`;

-- DropForeignKey
ALTER TABLE `authentication_user_two_factor_recovery_codes` DROP FOREIGN KEY `auth_u2f_recovery_user_fk`;

-- AlterTable
ALTER TABLE `authentication_user_two_factor_challenges` MODIFY `expires_at` DATETIME(3) NOT NULL,
    MODIFY `consumed_at` DATETIME(3) NULL,
    MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `authentication_user_two_factor_recovery_codes` MODIFY `used_at` DATETIME(3) NULL,
    MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `authentication_user_two_factors` MODIFY `enrollment_started_at` DATETIME(3) NULL,
    MODIFY `locked_until` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `authentication_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authentication_user_two_factor_challenges` ADD CONSTRAINT `authentication_user_two_factor_challenges_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authentication_user_two_factor_recovery_codes` ADD CONSTRAINT `authentication_user_two_factor_recovery_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `audit_logs` RENAME INDEX `idx_audit_logs_actor_user_id` TO `audit_logs_actor_user_id_idx`;

-- RenameIndex
ALTER TABLE `audit_logs` RENAME INDEX `idx_audit_logs_resource_id` TO `audit_logs_resource_id_idx`;

-- RenameIndex
ALTER TABLE `audit_logs` RENAME INDEX `idx_audit_logs_result` TO `audit_logs_result_idx`;

-- RenameIndex
ALTER TABLE `authentication_user_two_factor_challenges` RENAME INDEX `auth_u2f_challenge_consumed_idx` TO `authentication_user_two_factor_challenges_consumed_at_idx`;

-- RenameIndex
ALTER TABLE `authentication_user_two_factor_challenges` RENAME INDEX `auth_u2f_challenge_hash_key` TO `authentication_user_two_factor_challenges_challenge_hash_key`;

-- RenameIndex
ALTER TABLE `authentication_user_two_factor_challenges` RENAME INDEX `auth_u2f_challenge_user_exp_idx` TO `authentication_user_two_factor_challenges_user_id_expires_at_idx`;

-- RenameIndex
ALTER TABLE `authentication_user_two_factor_recovery_codes` RENAME INDEX `auth_u2f_recovery_user_used_idx` TO `authentication_user_two_factor_recovery_codes_user_id_used_a_idx`;
