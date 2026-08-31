-- DropForeignKey
ALTER TABLE `cities` DROP FOREIGN KEY `cities_province_fk`;

-- DropForeignKey
ALTER TABLE `districts` DROP FOREIGN KEY `districts_city_fk`;

-- DropForeignKey
ALTER TABLE `properties` DROP FOREIGN KEY `properties_category_fk`;

-- DropForeignKey
ALTER TABLE `properties` DROP FOREIGN KEY `properties_subcategory_fk`;

-- DropForeignKey
ALTER TABLE `properties` DROP FOREIGN KEY `properties_subdistrict_fk`;

-- DropForeignKey
ALTER TABLE `properties` DROP FOREIGN KEY `properties_type_fk`;

-- DropForeignKey
ALTER TABLE `property_agent_assignments` DROP FOREIGN KEY `property_agent_assignments_property_fk`;

-- DropForeignKey
ALTER TABLE `property_buildings` DROP FOREIGN KEY `property_buildings_property_fk`;

-- DropForeignKey
ALTER TABLE `property_categories` DROP FOREIGN KEY `property_categories_type_fk`;

-- DropForeignKey
ALTER TABLE `property_certificates` DROP FOREIGN KEY `property_certificates_property_fk`;

-- DropForeignKey
ALTER TABLE `property_environment` DROP FOREIGN KEY `property_environment_property_fk`;

-- DropForeignKey
ALTER TABLE `property_facilities` DROP FOREIGN KEY `property_facilities_facility_fk`;

-- DropForeignKey
ALTER TABLE `property_facilities` DROP FOREIGN KEY `property_facilities_property_fk`;

-- DropForeignKey
ALTER TABLE `property_features` DROP FOREIGN KEY `property_features_property_fk`;

-- DropForeignKey
ALTER TABLE `property_financials` DROP FOREIGN KEY `property_financials_property_fk`;

-- DropForeignKey
ALTER TABLE `property_legal` DROP FOREIGN KEY `property_legal_property_fk`;

-- DropForeignKey
ALTER TABLE `property_listing_analytics` DROP FOREIGN KEY `property_listing_analytics_listing_fk`;

-- DropForeignKey
ALTER TABLE `property_listing_engagements` DROP FOREIGN KEY `property_listing_engagements_listing_fk`;

-- DropForeignKey
ALTER TABLE `property_listing_payment_options` DROP FOREIGN KEY `property_listing_payment_options_listing_fk`;

-- DropForeignKey
ALTER TABLE `property_listing_prices` DROP FOREIGN KEY `property_listing_prices_listing_fk`;

-- DropForeignKey
ALTER TABLE `property_listings` DROP FOREIGN KEY `property_listings_property_fk`;

-- DropForeignKey
ALTER TABLE `property_locations` DROP FOREIGN KEY `property_locations_city_fk`;

-- DropForeignKey
ALTER TABLE `property_locations` DROP FOREIGN KEY `property_locations_country_fk`;

-- DropForeignKey
ALTER TABLE `property_locations` DROP FOREIGN KEY `property_locations_district_fk`;

-- DropForeignKey
ALTER TABLE `property_locations` DROP FOREIGN KEY `property_locations_property_fk`;

-- DropForeignKey
ALTER TABLE `property_locations` DROP FOREIGN KEY `property_locations_province_fk`;

-- DropForeignKey
ALTER TABLE `property_locations` DROP FOREIGN KEY `property_locations_subdistrict_fk`;

-- DropForeignKey
ALTER TABLE `property_media` DROP FOREIGN KEY `property_media_property_fk`;

-- DropForeignKey
ALTER TABLE `property_owners` DROP FOREIGN KEY `property_owners_property_fk`;

-- DropForeignKey
ALTER TABLE `property_rooms` DROP FOREIGN KEY `property_rooms_property_fk`;

-- DropForeignKey
ALTER TABLE `property_security` DROP FOREIGN KEY `property_security_property_fk`;

-- DropForeignKey
ALTER TABLE `property_seo` DROP FOREIGN KEY `property_seo_property_fk`;

-- DropForeignKey
ALTER TABLE `property_specifications` DROP FOREIGN KEY `property_specifications_property_fk`;

-- DropForeignKey
ALTER TABLE `property_subcategories` DROP FOREIGN KEY `property_subcategories_category_fk`;

-- DropForeignKey
ALTER TABLE `property_utilities` DROP FOREIGN KEY `property_utilities_property_fk`;

-- DropForeignKey
ALTER TABLE `provinces` DROP FOREIGN KEY `provinces_country_fk`;

-- DropForeignKey
ALTER TABLE `subdistricts` DROP FOREIGN KEY `subdistricts_district_fk`;

-- DropIndex
DROP INDEX `property_utilities_water_idx` ON `property_utilities`;

-- AlterTable
ALTER TABLE `authentication_refresh_token_families` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_agent_assignments` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_buildings` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_certificates` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_environment` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_facilities` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_features` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_financials` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_legal` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_listing_analytics` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_listing_engagements` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_listing_payment_options` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_listing_prices` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_listings` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_locations` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_media` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_owners` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_rooms` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_security` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_seo` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_specifications` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_utilities` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `cities` ADD CONSTRAINT `cities_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `districts` ADD CONSTRAINT `districts_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subdistricts` ADD CONSTRAINT `subdistricts_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `districts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provinces` ADD CONSTRAINT `provinces_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_categories` ADD CONSTRAINT `property_categories_property_type_id_fkey` FOREIGN KEY (`property_type_id`) REFERENCES `property_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_specifications` ADD CONSTRAINT `property_specifications_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_locations` ADD CONSTRAINT `property_locations_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_locations` ADD CONSTRAINT `property_locations_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_locations` ADD CONSTRAINT `property_locations_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `districts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_locations` ADD CONSTRAINT `property_locations_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_locations` ADD CONSTRAINT `property_locations_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_locations` ADD CONSTRAINT `property_locations_subdistrict_id_fkey` FOREIGN KEY (`subdistrict_id`) REFERENCES `subdistricts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_buildings` ADD CONSTRAINT `property_buildings_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_rooms` ADD CONSTRAINT `property_rooms_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_utilities` ADD CONSTRAINT `property_utilities_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_legal` ADD CONSTRAINT `property_legal_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_certificates` ADD CONSTRAINT `property_certificates_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_financials` ADD CONSTRAINT `property_financials_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_features` ADD CONSTRAINT `property_features_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_security` ADD CONSTRAINT `property_security_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_environment` ADD CONSTRAINT `property_environment_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_seo` ADD CONSTRAINT `property_seo_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_media` ADD CONSTRAINT `property_media_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_listings` ADD CONSTRAINT `property_listings_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_listing_prices` ADD CONSTRAINT `property_listing_prices_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `property_listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_listing_payment_options` ADD CONSTRAINT `property_listing_payment_options_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `property_listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_agent_assignments` ADD CONSTRAINT `property_agent_assignments_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_owners` ADD CONSTRAINT `property_owners_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_listing_analytics` ADD CONSTRAINT `property_listing_analytics_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `property_listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_listing_engagements` ADD CONSTRAINT `property_listing_engagements_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `property_listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_subcategories` ADD CONSTRAINT `property_subcategories_property_category_id_fkey` FOREIGN KEY (`property_category_id`) REFERENCES `property_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_property_category_id_fkey` FOREIGN KEY (`property_category_id`) REFERENCES `property_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_property_subcategory_id_fkey` FOREIGN KEY (`property_subcategory_id`) REFERENCES `property_subcategories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_property_type_id_fkey` FOREIGN KEY (`property_type_id`) REFERENCES `property_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_subdistrict_id_fkey` FOREIGN KEY (`subdistrict_id`) REFERENCES `subdistricts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_facilities` ADD CONSTRAINT `property_facilities_facility_id_fkey` FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_facilities` ADD CONSTRAINT `property_facilities_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `cities` RENAME INDEX `cities_active_deleted_sort_idx` TO `cities_is_active_deleted_at_sort_order_idx`;

-- RenameIndex
ALTER TABLE `cities` RENAME INDEX `cities_province_code_key` TO `cities_province_id_code_key`;

-- RenameIndex
ALTER TABLE `cities` RENAME INDEX `cities_province_idx` TO `cities_province_id_idx`;

-- RenameIndex
ALTER TABLE `cities` RENAME INDEX `cities_province_slug_key` TO `cities_province_id_slug_key`;

-- RenameIndex
ALTER TABLE `countries` RENAME INDEX `countries_active_deleted_sort_idx` TO `countries_is_active_deleted_at_sort_order_idx`;

-- RenameIndex
ALTER TABLE `districts` RENAME INDEX `districts_active_deleted_sort_idx` TO `districts_is_active_deleted_at_sort_order_idx`;

-- RenameIndex
ALTER TABLE `districts` RENAME INDEX `districts_city_code_key` TO `districts_city_id_code_key`;

-- RenameIndex
ALTER TABLE `districts` RENAME INDEX `districts_city_idx` TO `districts_city_id_idx`;

-- RenameIndex
ALTER TABLE `districts` RENAME INDEX `districts_city_slug_key` TO `districts_city_id_slug_key`;

-- RenameIndex
ALTER TABLE `facilities` RENAME INDEX `facilities_active_deleted_sort_idx` TO `facilities_is_active_deleted_at_sort_order_idx`;

-- RenameIndex
ALTER TABLE `properties` RENAME INDEX `properties_availability_idx` TO `properties_availability_status_available_from_available_to_idx`;

-- RenameIndex
ALTER TABLE `properties` RENAME INDEX `properties_category_fk` TO `properties_property_category_id_fkey`;

-- RenameIndex
ALTER TABLE `properties` RENAME INDEX `properties_subcategory_fk` TO `properties_property_subcategory_id_fkey`;

-- RenameIndex
ALTER TABLE `property_locations` RENAME INDEX `property_locations_city_fk` TO `property_locations_city_id_fkey`;

-- RenameIndex
ALTER TABLE `property_locations` RENAME INDEX `property_locations_district_fk` TO `property_locations_district_id_fkey`;

-- RenameIndex
ALTER TABLE `property_locations` RENAME INDEX `property_locations_province_fk` TO `property_locations_province_id_fkey`;

-- RenameIndex
ALTER TABLE `property_locations` RENAME INDEX `property_locations_subdistrict_fk` TO `property_locations_subdistrict_id_fkey`;
