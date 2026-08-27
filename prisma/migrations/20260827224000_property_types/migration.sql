-- CreateTable
CREATE TABLE `property_types` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    UNIQUE INDEX `property_types_uuid_key`(`uuid`),
    UNIQUE INDEX `property_types_code_key`(`code`),
    UNIQUE INDEX `property_types_slug_key`(`slug`),
    INDEX `property_types_is_active_idx`(`is_active`),
    INDEX `property_types_sort_order_idx`(`sort_order`),
    INDEX `property_types_deleted_at_idx`(`deleted_at`),
    INDEX `property_types_is_active_deleted_at_sort_order_idx`(`is_active`, `deleted_at`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Bootstrap the four Property Type capabilities and grant them to the existing
-- administrative role. Regular roles remain default-deny until assigned.
INSERT INTO authorization_permissions (uuid, name, code, module, domain, action, created_at, updated_at)
SELECT 'b4d4b9a6-7f16-4db3-9e9d-2f07ad5c9a11', 'Create Property Types', 'property-types.create', 'property', 'property-types', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM authorization_permissions WHERE code = 'property-types.create');

INSERT INTO authorization_permissions (uuid, name, code, module, domain, action, created_at, updated_at)
SELECT 'b4d4b9a6-7f16-4db3-9e9d-2f07ad5c9a12', 'Read Property Types', 'property-types.read', 'property', 'property-types', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM authorization_permissions WHERE code = 'property-types.read');

INSERT INTO authorization_permissions (uuid, name, code, module, domain, action, created_at, updated_at)
SELECT 'b4d4b9a6-7f16-4db3-9e9d-2f07ad5c9a13', 'Update Property Types', 'property-types.update', 'property', 'property-types', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM authorization_permissions WHERE code = 'property-types.update');

INSERT INTO authorization_permissions (uuid, name, code, module, domain, action, created_at, updated_at)
SELECT 'b4d4b9a6-7f16-4db3-9e9d-2f07ad5c9a14', 'Delete Property Types', 'property-types.delete', 'property', 'property-types', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM authorization_permissions WHERE code = 'property-types.delete');

INSERT INTO authorization_role_permissions (role_id, permission_id, created_at, updated_at)
SELECT role.id, permission.id, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM authorization_roles AS role
CROSS JOIN authorization_permissions AS permission
WHERE role.code = 'ADMIN'
  AND permission.code IN ('property-types.create', 'property-types.read', 'property-types.update', 'property-types.delete')
  AND NOT EXISTS (
    SELECT 1
    FROM authorization_role_permissions AS existing
    WHERE existing.role_id = role.id
      AND existing.permission_id = permission.id
  );
