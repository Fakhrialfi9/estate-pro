-- Phase 1 baseline generated with Prisma migrate diff from the pre-credentials schema.
-- Source schema commit: bbd38cf79078ca9d295de786a842f49055371623
-- This migration establishes the original Phase 1 schema so all subsequent
-- timestamped migrations can be deployed deterministically on fresh databases.

-- CreateTable
CREATE TABLE `audit_log_changes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `audit_log_id` BIGINT UNSIGNED NOT NULL,
    `field` VARCHAR(100) NOT NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `audit_log_changes_audit_log_id_idx`(`audit_log_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NULL,
    `entity_id` BIGINT UNSIGNED NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `request_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `audit_logs_uuid_key`(`uuid`),
    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_entity_type_idx`(`entity_type`),
    INDEX `audit_logs_entity_id_idx`(`entity_id`),
    INDEX `audit_logs_request_id_idx`(`request_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authentication_user_credentials` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `password_changed_at` DATETIME(3) NULL,
    `password_expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `authentication_user_credentials_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authentication_user_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `image_url` VARCHAR(500) NULL,
    `avatar_thumbnail_url` VARCHAR(500) NULL,
    `timezone` VARCHAR(100) NOT NULL DEFAULT 'Asia/Jakarta',
    `locale` VARCHAR(10) NOT NULL DEFAULT 'id',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `authentication_user_profiles_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authentication_user_security` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `phone_verified_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `failed_login_attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `authentication_user_security_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authentication_user_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `session_id` VARCHAR(64) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `last_activity_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `authentication_user_sessions_session_id_key`(`session_id`),
    INDEX `authentication_user_sessions_user_id_idx`(`user_id`),
    INDEX `authentication_user_sessions_revoked_at_idx`(`revoked_at`),
    INDEX `authentication_user_sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authentication_user_two_factors` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `method` VARCHAR(30) NOT NULL DEFAULT 'totp',
    `secret_encrypted` TEXT NOT NULL,
    `enabled_at` DATETIME(3) NULL,
    `last_used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `authentication_user_two_factors_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authentication_users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `username` VARCHAR(100) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(30) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    UNIQUE INDEX `authentication_users_uuid_key`(`uuid`),
    UNIQUE INDEX `authentication_users_username_key`(`username`),
    UNIQUE INDEX `authentication_users_email_key`(`email`),
    UNIQUE INDEX `authentication_users_phone_key`(`phone`),
    INDEX `authentication_users_status_idx`(`status`),
    INDEX `authentication_users_is_active_idx`(`is_active`),
    INDEX `authentication_users_deleted_at_idx`(`deleted_at`),
    INDEX `authentication_users_status_deleted_at_idx`(`status`, `deleted_at`),
    INDEX `authentication_users_is_active_deleted_at_idx`(`is_active`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authorization_permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(150) NOT NULL,
    `module` VARCHAR(100) NOT NULL,
    `domain` VARCHAR(100) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `authorization_permissions_uuid_key`(`uuid`),
    UNIQUE INDEX `authorization_permissions_code_key`(`code`),
    INDEX `authorization_permissions_module_idx`(`module`),
    INDEX `authorization_permissions_domain_idx`(`domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authorization_role_permissions` (
    `role_id` BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authorization_roles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `authorization_roles_uuid_key`(`uuid`),
    UNIQUE INDEX `authorization_roles_code_key`(`code`),
    INDEX `authorization_roles_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authorization_user_roles` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `assigned_by` BIGINT UNSIGNED NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `authorization_user_roles_is_active_idx`(`is_active`),
    INDEX `authorization_user_roles_assigned_by_idx`(`assigned_by`),
    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_log_changes` ADD CONSTRAINT `audit_log_changes_audit_log_id_fkey` FOREIGN KEY (`audit_log_id`) REFERENCES `audit_logs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `authentication_user_credentials` ADD CONSTRAINT `authentication_user_credentials_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authentication_user_profiles` ADD CONSTRAINT `authentication_user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authentication_user_security` ADD CONSTRAINT `authentication_user_security_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authentication_user_sessions` ADD CONSTRAINT `authentication_user_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authentication_user_two_factors` ADD CONSTRAINT `authentication_user_two_factors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authorization_role_permissions` ADD CONSTRAINT `authorization_role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `authorization_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authorization_role_permissions` ADD CONSTRAINT `authorization_role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `authorization_permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authorization_user_roles` ADD CONSTRAINT `authorization_user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authorization_user_roles` ADD CONSTRAINT `authorization_user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `authorization_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `authorization_user_roles` ADD CONSTRAINT `authorization_user_roles_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `authentication_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
