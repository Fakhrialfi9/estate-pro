/*
  Warnings:

  - You are about to drop the column `updated_at` on the `agent_availability_exceptions` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `agent_coverages` table. All the data in the column will be lost.
  - You are about to drop the column `structured_data` on the `content_seo` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_feature_flags` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `system_feature_flags` table. All the data in the column will be lost.
  - You are about to drop the column `rollout_percentage` on the `system_feature_flags` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_feature_flags` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `system_feature_flags` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_import_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `system_import_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_import_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `system_import_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_integration_conflicts` table. All the data in the column will be lost.
  - You are about to drop the column `entity_type` on the `system_integration_conflicts` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_integration_conflicts` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_integration_credentials` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_integration_events` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_integration_idempotency` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_integration_idempotency` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_integration_operations` table. All the data in the column will be lost.
  - You are about to drop the column `error_code` on the `system_integration_operations` table. All the data in the column will be lost.
  - You are about to drop the column `error_message` on the `system_integration_operations` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_integration_operations` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_integration_runtime` table. All the data in the column will be lost.
  - You are about to drop the column `request_mapping` on the `system_integration_runtime` table. All the data in the column will be lost.
  - You are about to drop the column `response_mapping` on the `system_integration_runtime` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_integration_runtime` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_operational_alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_operational_alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `system_operational_alerts` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `system_operational_alerts` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `agent_availability_exceptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `agent_coverages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_feature_flags` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `system_import_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_import_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `system_import_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `system_integration_conflicts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_integration_conflicts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_integration_credentials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_integration_idempotency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_integration_operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestMapping` to the `system_integration_runtime` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responseMapping` to the `system_integration_runtime` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_integration_runtime` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_operational_alert_rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `system_operational_alerts` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `agent_availability` DROP FOREIGN KEY `agent_availability_agent_fk`;

-- DropForeignKey
ALTER TABLE `agent_availability_exceptions` DROP FOREIGN KEY `agent_availability_exceptions_agent_fk`;

-- DropForeignKey
ALTER TABLE `agent_coverages` DROP FOREIGN KEY `agent_coverages_agent_fk`;

-- DropForeignKey
ALTER TABLE `agent_specialization_links` DROP FOREIGN KEY `agent_specialization_links_agent_fk`;

-- DropForeignKey
ALTER TABLE `agent_specialization_links` DROP FOREIGN KEY `agent_specialization_links_specialization_fk`;

-- DropForeignKey
ALTER TABLE `agent_targets` DROP FOREIGN KEY `agent_targets_agent_fk`;

-- DropForeignKey
ALTER TABLE `agent_weekly_schedules` DROP FOREIGN KEY `agent_weekly_schedules_agent_fk`;

-- DropForeignKey
ALTER TABLE `automation_notification_deliveries` DROP FOREIGN KEY `automation_notification_deliveries_notification_fk`;

-- DropForeignKey
ALTER TABLE `cities` DROP FOREIGN KEY `cities_province_fk`;

-- DropForeignKey
ALTER TABLE `content_article_bookmarks` DROP FOREIGN KEY `content_article_bookmarks_article_fk`;

-- DropForeignKey
ALTER TABLE `content_article_likes` DROP FOREIGN KEY `content_article_likes_article_fk`;

-- DropForeignKey
ALTER TABLE `content_article_statistics` DROP FOREIGN KEY `content_article_statistics_article_fk`;

-- DropForeignKey
ALTER TABLE `content_article_tags` DROP FOREIGN KEY `content_article_tags_article_fk`;

-- DropForeignKey
ALTER TABLE `content_article_tags` DROP FOREIGN KEY `content_article_tags_tag_fk`;

-- DropForeignKey
ALTER TABLE `content_articles` DROP FOREIGN KEY `content_articles_category_fk`;

-- DropForeignKey
ALTER TABLE `content_articles` DROP FOREIGN KEY `content_articles_cover_media_fk`;

-- DropForeignKey
ALTER TABLE `content_banners` DROP FOREIGN KEY `content_banners_desktop_media_fk`;

-- DropForeignKey
ALTER TABLE `content_banners` DROP FOREIGN KEY `content_banners_mobile_media_fk`;

-- DropForeignKey
ALTER TABLE `content_comments` DROP FOREIGN KEY `content_comments_article_fk`;

-- DropForeignKey
ALTER TABLE `content_media` DROP FOREIGN KEY `content_media_folder_fk`;

-- DropForeignKey
ALTER TABLE `content_menu_items` DROP FOREIGN KEY `content_menu_items_menu_fk`;

-- DropForeignKey
ALTER TABLE `crm_activities` DROP FOREIGN KEY `crm_activities_contact_fkey`;

-- DropForeignKey
ALTER TABLE `crm_activities` DROP FOREIGN KEY `crm_activities_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_communications` DROP FOREIGN KEY `crm_communications_activity_fkey`;

-- DropForeignKey
ALTER TABLE `crm_communications` DROP FOREIGN KEY `crm_communications_contact_fkey`;

-- DropForeignKey
ALTER TABLE `crm_communications` DROP FOREIGN KEY `crm_communications_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_communications` DROP FOREIGN KEY `crm_communications_template_fkey`;

-- DropForeignKey
ALTER TABLE `crm_inquiries` DROP FOREIGN KEY `crm_inquiries_contact_fkey`;

-- DropForeignKey
ALTER TABLE `crm_inquiries` DROP FOREIGN KEY `crm_inquiries_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_assignments` DROP FOREIGN KEY `crm_lead_assignments_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_campaigns` DROP FOREIGN KEY `crm_lead_campaigns_sourceId_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_duplicates` DROP FOREIGN KEY `crm_lead_duplicates_candidate_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_duplicates` DROP FOREIGN KEY `crm_lead_duplicates_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_history` DROP FOREIGN KEY `crm_lead_history_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_notes` DROP FOREIGN KEY `crm_lead_notes_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_scores` DROP FOREIGN KEY `crm_lead_scores_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_status_transitions` DROP FOREIGN KEY `crm_lead_status_transitions_from_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_status_transitions` DROP FOREIGN KEY `crm_lead_status_transitions_to_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_tag_links` DROP FOREIGN KEY `crm_lead_tag_links_lead_fkey`;

-- DropForeignKey
ALTER TABLE `crm_lead_tag_links` DROP FOREIGN KEY `crm_lead_tag_links_tag_fkey`;

-- DropForeignKey
ALTER TABLE `crm_leads` DROP FOREIGN KEY `crm_leads_campaignId_fkey`;

-- DropForeignKey
ALTER TABLE `crm_leads` DROP FOREIGN KEY `crm_leads_contactId_fkey`;

-- DropForeignKey
ALTER TABLE `crm_leads` DROP FOREIGN KEY `crm_leads_sourceId_fkey`;

-- DropForeignKey
ALTER TABLE `crm_leads` DROP FOREIGN KEY `crm_leads_statusId_fkey`;

-- DropForeignKey
ALTER TABLE `crm_leads` DROP FOREIGN KEY `crm_leads_typeId_fkey`;

-- DropForeignKey
ALTER TABLE `districts` DROP FOREIGN KEY `districts_city_fk`;

-- DropForeignKey
ALTER TABLE `match_feedback` DROP FOREIGN KEY `match_feedback_item_fk`;

-- DropForeignKey
ALTER TABLE `properties` DROP FOREIGN KEY `properties_category_fk`;

-- DropForeignKey
ALTER TABLE `properties` DROP FOREIGN KEY `properties_subcategory_fk`;

-- DropForeignKey
ALTER TABLE `properties` DROP FOREIGN KEY `properties_subdistrict_fk`;

-- DropForeignKey
ALTER TABLE `properties` DROP FOREIGN KEY `properties_type_fk`;

-- DropForeignKey
ALTER TABLE `property_agent_assignment_history` DROP FOREIGN KEY `property_agent_assignment_history_property_fk`;

-- DropForeignKey
ALTER TABLE `property_agent_assignments` DROP FOREIGN KEY `property_agent_assignments_property_fk`;

-- DropForeignKey
ALTER TABLE `property_amenity_assignments` DROP FOREIGN KEY `property_amenity_assignments_amenity_fk`;

-- DropForeignKey
ALTER TABLE `property_amenity_assignments` DROP FOREIGN KEY `property_amenity_assignments_property_fk`;

-- DropForeignKey
ALTER TABLE `property_buildings` DROP FOREIGN KEY `property_buildings_property_fk`;

-- DropForeignKey
ALTER TABLE `property_categories` DROP FOREIGN KEY `property_categories_type_fk`;

-- DropForeignKey
ALTER TABLE `property_certificates` DROP FOREIGN KEY `property_certificates_property_fk`;

-- DropForeignKey
ALTER TABLE `property_document_versions` DROP FOREIGN KEY `property_document_versions_document_fk`;

-- DropForeignKey
ALTER TABLE `property_documents` DROP FOREIGN KEY `property_documents_property_fk`;

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
ALTER TABLE `property_history` DROP FOREIGN KEY `property_history_property_fk`;

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
ALTER TABLE `recommendation_history` DROP FOREIGN KEY `recommendation_history_recommendation_fk`;

-- DropForeignKey
ALTER TABLE `recommendation_items` DROP FOREIGN KEY `recommendation_items_recommendation_fk`;

-- DropForeignKey
ALTER TABLE `subdistricts` DROP FOREIGN KEY `subdistricts_district_fk`;

-- DropForeignKey
ALTER TABLE `system_integration_conflicts` DROP FOREIGN KEY `system_integration_conflicts_integration_fk`;

-- DropForeignKey
ALTER TABLE `system_integration_credentials` DROP FOREIGN KEY `system_integration_credentials_integration_fk`;

-- DropForeignKey
ALTER TABLE `system_integration_events` DROP FOREIGN KEY `system_integration_events_integration_fk`;

-- DropForeignKey
ALTER TABLE `system_integration_operations` DROP FOREIGN KEY `system_integration_operations_integration_fk`;

-- DropForeignKey
ALTER TABLE `system_integration_runtime` DROP FOREIGN KEY `system_integration_runtime_integration_fk`;

-- DropForeignKey
ALTER TABLE `system_webhook_deliveries` DROP FOREIGN KEY `system_webhook_deliveries_subscription_id_fk`;

-- DropIndex
DROP INDEX `crm_communications_activity_fkey` ON `crm_communications`;

-- DropIndex
DROP INDEX `crm_communications_template_fkey` ON `crm_communications`;

-- DropIndex
DROP INDEX `crm_inquiries_lead_fkey` ON `crm_inquiries`;

-- DropIndex
DROP INDEX `crm_lead_status_transitions_to_fkey` ON `crm_lead_status_transitions`;

-- DropIndex
DROP INDEX `crm_leads_campaignId_fkey` ON `crm_leads`;

-- DropIndex
DROP INDEX `crm_leads_sourceId_fkey` ON `crm_leads`;

-- DropIndex
DROP INDEX `crm_leads_typeId_fkey` ON `crm_leads`;

-- DropIndex
DROP INDEX `property_utilities_water_idx` ON `property_utilities`;

-- DropIndex
DROP INDEX `sales_opportunities_contactUuid_idx` ON `sales_opportunities`;

-- DropIndex
DROP INDEX `system_integration_idempotency_status_idx` ON `system_integration_idempotency`;

-- AlterTable
ALTER TABLE `agent_availability` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `agent_availability_exceptions` DROP COLUMN `updated_at`,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `agent_coverages` DROP COLUMN `updated_at`,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `agent_profiles` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `agent_specialization_links` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `agent_specializations` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `agent_targets` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `agent_weekly_schedules` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `authentication_refresh_token_families` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `automation_action_executions` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `automation_assignment_rules` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `automation_escalation_policies` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `automation_sla_instances` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `automation_sla_policies` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `automation_workflow_executions` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `automation_workflows` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_article_categories` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_article_statistics` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_articles` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_banners` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_comments` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_faqs` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_media` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_media_folders` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_menu_items` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_menus` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_pages` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_redirects` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_seo` DROP COLUMN `structured_data`,
    ADD COLUMN `structuredData` JSON NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_tags` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `content_testimonials` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `match_feedback` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_agent_assignments` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_amenities` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_amenity_assignments` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_buildings` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_certificates` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `property_documents` ALTER COLUMN `updated_at` DROP DEFAULT;

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
ALTER TABLE `property_preferences` ALTER COLUMN `updated_at` DROP DEFAULT;

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

-- AlterTable
ALTER TABLE `sales_activities` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_commission_rules` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_deal_items` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_deals` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_lost_reasons` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_negotiations` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_opportunities` ALTER COLUMN `title` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_pipeline_stages` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_pipelines` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sales_viewings` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `system_export_jobs` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `system_feature_flags` DROP COLUMN `created_at`,
    DROP COLUMN `created_by`,
    DROP COLUMN `rollout_percentage`,
    DROP COLUMN `updated_at`,
    DROP COLUMN `updated_by`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdBy` CHAR(36) NULL,
    ADD COLUMN `rolloutPercentage` INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedBy` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `system_import_jobs` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `system_import_profiles` DROP COLUMN `created_at`,
    DROP COLUMN `created_by`,
    DROP COLUMN `updated_at`,
    DROP COLUMN `updated_by`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdBy` CHAR(36) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedBy` CHAR(36) NOT NULL;

-- AlterTable
ALTER TABLE `system_integration_conflicts` DROP COLUMN `created_at`,
    DROP COLUMN `entity_type`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `entityType` VARCHAR(80) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `system_integration_credentials` DROP COLUMN `updated_at`,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `secret_ref` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `system_integration_events` DROP COLUMN `created_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `system_integration_idempotency` DROP COLUMN `created_at`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `system_integration_operations` DROP COLUMN `created_at`,
    DROP COLUMN `error_code`,
    DROP COLUMN `error_message`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `errorCode` VARCHAR(80) NULL,
    ADD COLUMN `errorMessage` VARCHAR(500) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `system_integration_runtime` DROP COLUMN `created_at`,
    DROP COLUMN `request_mapping`,
    DROP COLUMN `response_mapping`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `requestMapping` JSON NOT NULL,
    ADD COLUMN `responseMapping` JSON NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `system_integrations` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `system_operational_alert_rules` DROP COLUMN `created_at`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `system_operational_alerts` DROP COLUMN `created_at`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `system_settings` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `system_webhook_deliveries` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `system_webhook_subscriptions` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `content_seo_entity_type_entity_uuid_idx` ON `content_seo`(`entity_type`, `entity_uuid`);

-- CreateIndex
CREATE INDEX `system_integration_conflicts_integration_id_status_createdAt_idx` ON `system_integration_conflicts`(`integration_id`, `status`, `createdAt`);

-- CreateIndex
CREATE INDEX `system_integration_credentials_integration_id_credential_typ_idx` ON `system_integration_credentials`(`integration_id`, `credential_type`, `status`);

-- CreateIndex
CREATE INDEX `system_integration_events_payload_hash_idx` ON `system_integration_events`(`payload_hash`);

-- CreateIndex
CREATE INDEX `system_integration_idempotency_integration_id_status_updated_idx` ON `system_integration_idempotency`(`integration_id`, `status`, `updatedAt`);

-- CreateIndex
CREATE INDEX `system_integration_operations_operation_key_createdAt_idx` ON `system_integration_operations`(`operation_key`, `createdAt`);

-- CreateIndex
CREATE INDEX `system_integration_runtime_last_health_at_idx` ON `system_integration_runtime`(`last_health_at`);

-- CreateIndex
CREATE INDEX `system_operational_alerts_alert_key_status_idx` ON `system_operational_alerts`(`alert_key`, `status`);

-- AddForeignKey
ALTER TABLE `agent_specialization_links` ADD CONSTRAINT `agent_specialization_links_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_specialization_links` ADD CONSTRAINT `agent_specialization_links_specialization_id_fkey` FOREIGN KEY (`specialization_id`) REFERENCES `agent_specializations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_coverages` ADD CONSTRAINT `agent_coverages_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_availability` ADD CONSTRAINT `agent_availability_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_weekly_schedules` ADD CONSTRAINT `agent_weekly_schedules_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_availability_exceptions` ADD CONSTRAINT `agent_availability_exceptions_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_targets` ADD CONSTRAINT `agent_targets_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_media` ADD CONSTRAINT `content_media_folder_id_fkey` FOREIGN KEY (`folder_id`) REFERENCES `content_media_folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_articles` ADD CONSTRAINT `content_articles_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `content_article_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_articles` ADD CONSTRAINT `content_articles_cover_media_id_fkey` FOREIGN KEY (`cover_media_id`) REFERENCES `content_media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_article_tags` ADD CONSTRAINT `content_article_tags_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `content_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_article_tags` ADD CONSTRAINT `content_article_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `content_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_banners` ADD CONSTRAINT `content_banners_desktop_media_id_fkey` FOREIGN KEY (`desktop_media_id`) REFERENCES `content_media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_banners` ADD CONSTRAINT `content_banners_mobile_media_id_fkey` FOREIGN KEY (`mobile_media_id`) REFERENCES `content_media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_menu_items` ADD CONSTRAINT `content_menu_items_menu_id_fkey` FOREIGN KEY (`menu_id`) REFERENCES `content_menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_article_statistics` ADD CONSTRAINT `content_article_statistics_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `content_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_comments` ADD CONSTRAINT `content_comments_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `content_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_article_likes` ADD CONSTRAINT `content_article_likes_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `content_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_article_bookmarks` ADD CONSTRAINT `content_article_bookmarks_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `content_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_campaigns` ADD CONSTRAINT `crm_lead_campaigns_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `crm_lead_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_status_transitions` ADD CONSTRAINT `crm_lead_status_transitions_fromStatusId_fkey` FOREIGN KEY (`fromStatusId`) REFERENCES `crm_lead_statuses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_status_transitions` ADD CONSTRAINT `crm_lead_status_transitions_toStatusId_fkey` FOREIGN KEY (`toStatusId`) REFERENCES `crm_lead_statuses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_leads` ADD CONSTRAINT `crm_leads_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `crm_contacts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_leads` ADD CONSTRAINT `crm_leads_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `crm_lead_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_leads` ADD CONSTRAINT `crm_leads_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `crm_lead_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_leads` ADD CONSTRAINT `crm_leads_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `crm_lead_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_leads` ADD CONSTRAINT `crm_leads_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `crm_lead_statuses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_tag_links` ADD CONSTRAINT `crm_lead_tag_links_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_tag_links` ADD CONSTRAINT `crm_lead_tag_links_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `crm_lead_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_notes` ADD CONSTRAINT `crm_lead_notes_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_assignments` ADD CONSTRAINT `crm_lead_assignments_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_scores` ADD CONSTRAINT `crm_lead_scores_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_duplicates` ADD CONSTRAINT `crm_lead_duplicates_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_duplicates` ADD CONSTRAINT `crm_lead_duplicates_candidateLeadId_fkey` FOREIGN KEY (`candidateLeadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_history` ADD CONSTRAINT `crm_lead_history_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_inquiries` ADD CONSTRAINT `crm_inquiries_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_inquiries` ADD CONSTRAINT `crm_inquiries_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_communications` ADD CONSTRAINT `crm_communications_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_communications` ADD CONSTRAINT `crm_communications_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_communications` ADD CONSTRAINT `crm_communications_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `crm_activities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_communications` ADD CONSTRAINT `crm_communications_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `crm_communication_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cities` ADD CONSTRAINT `cities_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `districts` ADD CONSTRAINT `districts_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subdistricts` ADD CONSTRAINT `subdistricts_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `districts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provinces` ADD CONSTRAINT `provinces_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_agent_assignment_history` ADD CONSTRAINT `property_agent_assignment_history_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_amenity_assignments` ADD CONSTRAINT `property_amenity_assignments_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_amenity_assignments` ADD CONSTRAINT `property_amenity_assignments_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `property_amenities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_documents` ADD CONSTRAINT `property_documents_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_document_versions` ADD CONSTRAINT `property_document_versions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `property_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_history` ADD CONSTRAINT `property_history_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE `recommendation_items` ADD CONSTRAINT `recommendation_items_recommendation_id_fkey` FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_history` ADD CONSTRAINT `recommendation_history_recommendation_id_fkey` FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `match_feedback` ADD CONSTRAINT `match_feedback_recommendation_item_id_fkey` FOREIGN KEY (`recommendation_item_id`) REFERENCES `recommendation_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_webhook_deliveries` ADD CONSTRAINT `system_webhook_deliveries_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `system_webhook_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `agent_availability` RENAME INDEX `agent_availability_agent_key` TO `agent_availability_agent_id_key`;

-- RenameIndex
ALTER TABLE `agent_availability` RENAME INDEX `agent_availability_status_effective_idx` TO `agent_availability_status_effective_at_idx`;

-- RenameIndex
ALTER TABLE `agent_availability_exceptions` RENAME INDEX `agent_availability_exceptions_agent_range_idx` TO `agent_availability_exceptions_agent_id_starts_at_ends_at_idx`;

-- RenameIndex
ALTER TABLE `agent_coverages` RENAME INDEX `agent_coverages_agent_active_idx` TO `agent_coverages_agent_id_is_active_idx`;

-- RenameIndex
ALTER TABLE `agent_coverages` RENAME INDEX `agent_coverages_level_region_active_idx` TO `agent_coverages_level_region_uuid_is_active_idx`;

-- RenameIndex
ALTER TABLE `agent_profiles` RENAME INDEX `agent_profiles_status_deleted_updated_idx` TO `agent_profiles_status_deleted_at_updated_at_idx`;

-- RenameIndex
ALTER TABLE `agent_profiles` RENAME INDEX `agent_profiles_timezone_idx` TO `agent_profiles_time_zone_idx`;

-- RenameIndex
ALTER TABLE `agent_specialization_links` RENAME INDEX `agent_specialization_links_agent_primary_idx` TO `agent_specialization_links_agent_id_is_primary_idx`;

-- RenameIndex
ALTER TABLE `agent_specialization_links` RENAME INDEX `agent_specialization_links_specialization_primary_idx` TO `agent_specialization_links_specialization_id_is_primary_idx`;

-- RenameIndex
ALTER TABLE `agent_specializations` RENAME INDEX `agent_specializations_active_order_idx` TO `agent_specializations_is_active_sort_order_idx`;

-- RenameIndex
ALTER TABLE `agent_targets` RENAME INDEX `agent_targets_agent_status_period_idx` TO `agent_targets_agent_id_status_period_start_period_end_idx`;

-- RenameIndex
ALTER TABLE `agent_targets` RENAME INDEX `agent_targets_metric_status_period_idx` TO `agent_targets_metric_type_status_period_start_period_end_idx`;

-- RenameIndex
ALTER TABLE `agent_weekly_schedules` RENAME INDEX `agent_weekly_schedule_agent_day_active_idx` TO `agent_weekly_schedules_agent_id_weekday_is_active_idx`;

-- RenameIndex
ALTER TABLE `agent_weekly_schedules` RENAME INDEX `agent_weekly_schedule_uuid_key` TO `agent_weekly_schedules_uuid_key`;

-- RenameIndex
ALTER TABLE `automation_action_executions` RENAME INDEX `automation_action_executions_execution_node_key` TO `automation_action_executions_executionUuid_nodeId_key`;

-- RenameIndex
ALTER TABLE `automation_action_executions` RENAME INDEX `automation_action_executions_lease_state_idx` TO `automation_action_executions_leaseUntil_state_idx`;

-- RenameIndex
ALTER TABLE `automation_action_executions` RENAME INDEX `automation_action_executions_state_available_created_idx` TO `automation_action_executions_state_availableAt_createdAt_idx`;

-- RenameIndex
ALTER TABLE `automation_assignment_rules` RENAME INDEX `automation_assignment_rules_workflow_active_idx` TO `automation_assignment_rules_workflowUuid_isActive_idx`;

-- RenameIndex
ALTER TABLE `automation_escalation_policies` RENAME INDEX `automation_escalation_policies_workflow_active_idx` TO `automation_escalation_policies_workflowUuid_isActive_idx`;

-- RenameIndex
ALTER TABLE `automation_notification_deliveries` RENAME INDEX `automation_notification_deliveries_channel_state_available_idx` TO `automation_notification_deliveries_channel_state_available_a_idx`;

-- RenameIndex
ALTER TABLE `automation_notification_deliveries` RENAME INDEX `automation_notification_deliveries_notification_channel_key` TO `automation_notification_deliveries_notification_uuid_channel_key`;

-- RenameIndex
ALTER TABLE `automation_notification_deliveries` RENAME INDEX `automation_notification_deliveries_state_available_created_idx` TO `automation_notification_deliveries_state_available_at_create_idx`;

-- RenameIndex
ALTER TABLE `automation_notification_preferences` RENAME INDEX `automation_notification_preferences_user_enabled_idx` TO `automation_notification_preferences_userUuid_enabled_idx`;

-- RenameIndex
ALTER TABLE `automation_notification_preferences` RENAME INDEX `automation_notification_preferences_user_type_channel_key` TO `automation_notification_preferences_userUuid_notificationTyp_key`;

-- RenameIndex
ALTER TABLE `automation_notifications` RENAME INDEX `automation_notifications_entity_created_idx` TO `automation_notifications_entityType_entityUuid_createdAt_idx`;

-- RenameIndex
ALTER TABLE `automation_notifications` RENAME INDEX `automation_notifications_user_status_created_idx` TO `automation_notifications_userUuid_status_createdAt_idx`;

-- RenameIndex
ALTER TABLE `automation_sla_instances` RENAME INDEX `automation_sla_instances_entity_state_idx` TO `automation_sla_instances_entityType_entityUuid_state_idx`;

-- RenameIndex
ALTER TABLE `automation_sla_instances` RENAME INDEX `automation_sla_instances_policy_entity_started_key` TO `automation_sla_instances_policyUuid_entityUuid_startedAt_key`;

-- RenameIndex
ALTER TABLE `automation_sla_instances` RENAME INDEX `automation_sla_instances_state_deadline_idx` TO `automation_sla_instances_state_deadlineAt_idx`;

-- RenameIndex
ALTER TABLE `automation_sla_policies` RENAME INDEX `automation_sla_policies_workflow_active_idx` TO `automation_sla_policies_workflowUuid_isActive_idx`;

-- RenameIndex
ALTER TABLE `automation_workflow_executions` RENAME INDEX `automation_workflow_executions_entity_created_idx` TO `automation_workflow_executions_entityType_entityUuid_created_idx`;

-- RenameIndex
ALTER TABLE `automation_workflow_executions` RENAME INDEX `automation_workflow_executions_lease_state_idx` TO `automation_workflow_executions_leaseUntil_state_idx`;

-- RenameIndex
ALTER TABLE `automation_workflow_executions` RENAME INDEX `automation_workflow_executions_state_retry_created_idx` TO `automation_workflow_executions_state_retryAt_createdAt_idx`;

-- RenameIndex
ALTER TABLE `automation_workflow_executions` RENAME INDEX `automation_workflow_executions_version_event_key` TO `automation_workflow_executions_workflowVersionUuid_eventId_key`;

-- RenameIndex
ALTER TABLE `automation_workflow_executions` RENAME INDEX `automation_workflow_executions_workflow_state_created_idx` TO `automation_workflow_executions_workflowUuid_state_createdAt_idx`;

-- RenameIndex
ALTER TABLE `cities` RENAME INDEX `cities_active_deleted_sort_idx` TO `cities_is_active_deleted_at_sort_order_idx`;

-- RenameIndex
ALTER TABLE `cities` RENAME INDEX `cities_province_code_key` TO `cities_province_id_code_key`;

-- RenameIndex
ALTER TABLE `cities` RENAME INDEX `cities_province_idx` TO `cities_province_id_idx`;

-- RenameIndex
ALTER TABLE `cities` RENAME INDEX `cities_province_slug_key` TO `cities_province_id_slug_key`;

-- RenameIndex
ALTER TABLE `content_article_bookmarks` RENAME INDEX `content_article_bookmarks_unique_key` TO `content_article_bookmarks_article_id_user_uuid_key`;

-- RenameIndex
ALTER TABLE `content_article_bookmarks` RENAME INDEX `content_article_bookmarks_user_article_idx` TO `content_article_bookmarks_user_uuid_article_id_idx`;

-- RenameIndex
ALTER TABLE `content_article_categories` RENAME INDEX `content_article_categories_parentId_deletedAt_idx` TO `content_article_categories_parent_id_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_article_categories` RENAME INDEX `content_article_categories_status_deletedAt_idx` TO `content_article_categories_status_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_article_likes` RENAME INDEX `content_article_likes_unique_key` TO `content_article_likes_article_id_user_uuid_key`;

-- RenameIndex
ALTER TABLE `content_article_likes` RENAME INDEX `content_article_likes_user_article_idx` TO `content_article_likes_user_uuid_article_id_idx`;

-- RenameIndex
ALTER TABLE `content_article_statistics` RENAME INDEX `content_article_statistics_article_key` TO `content_article_statistics_article_id_key`;

-- RenameIndex
ALTER TABLE `content_article_tags` RENAME INDEX `content_article_tags_tag_article_idx` TO `content_article_tags_tag_id_article_id_idx`;

-- RenameIndex
ALTER TABLE `content_article_views` RENAME INDEX `content_article_views_article_date_idx` TO `content_article_views_article_id_viewed_date_idx`;

-- RenameIndex
ALTER TABLE `content_article_views` RENAME INDEX `content_article_views_unique_key` TO `content_article_views_article_id_fingerprint_viewed_date_key`;

-- RenameIndex
ALTER TABLE `content_articles` RENAME INDEX `content_articles_authorUuid_status_deletedAt_idx` TO `content_articles_author_uuid_status_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_articles` RENAME INDEX `content_articles_categoryId_status_deletedAt_idx` TO `content_articles_category_id_status_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_articles` RENAME INDEX `content_articles_featured_status_publishedAt_idx` TO `content_articles_featured_status_published_at_idx`;

-- RenameIndex
ALTER TABLE `content_articles` RENAME INDEX `content_articles_language_status_deletedAt_idx` TO `content_articles_language_status_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_articles` RENAME INDEX `content_articles_scheduledAt_status_idx` TO `content_articles_scheduled_at_status_idx`;

-- RenameIndex
ALTER TABLE `content_articles` RENAME INDEX `content_articles_status_visibility_publishedAt_id_idx` TO `content_articles_status_visibility_published_at_id_idx`;

-- RenameIndex
ALTER TABLE `content_banners` RENAME INDEX `content_banners_placement_status_date_priority_idx` TO `content_banners_placement_status_start_at_end_at_priority_idx`;

-- RenameIndex
ALTER TABLE `content_comments` RENAME INDEX `content_comments_article_status_created_idx` TO `content_comments_article_id_status_created_at_idx`;

-- RenameIndex
ALTER TABLE `content_comments` RENAME INDEX `content_comments_user_created_idx` TO `content_comments_user_uuid_created_at_idx`;

-- RenameIndex
ALTER TABLE `content_faqs` RENAME INDEX `content_faqs_status_language_sort_idx` TO `content_faqs_status_language_sort_order_id_idx`;

-- RenameIndex
ALTER TABLE `content_media` RENAME INDEX `content_media_folderId_deletedAt_idx` TO `content_media_folder_id_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_media` RENAME INDEX `content_media_mimeType_deletedAt_idx` TO `content_media_mime_type_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_media` RENAME INDEX `content_media_uploaderUuid_deletedAt_idx` TO `content_media_uploader_uuid_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_media_folders` RENAME INDEX `content_media_folders_parentId_deletedAt_idx` TO `content_media_folders_parent_id_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_media_folders` RENAME INDEX `content_media_folders_slug_parentId_key` TO `content_media_folders_slug_parent_id_key`;

-- RenameIndex
ALTER TABLE `content_menu_items` RENAME INDEX `content_menu_items_menu_parent_sort_idx` TO `content_menu_items_menu_id_parent_id_sort_order_id_idx`;

-- RenameIndex
ALTER TABLE `content_pages` RENAME INDEX `content_pages_language_status_deletedAt_idx` TO `content_pages_language_status_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_pages` RENAME INDEX `content_pages_scheduledAt_status_idx` TO `content_pages_scheduled_at_status_idx`;

-- RenameIndex
ALTER TABLE `content_pages` RENAME INDEX `content_pages_status_visibility_publishedAt_id_idx` TO `content_pages_status_visibility_published_at_id_idx`;

-- RenameIndex
ALTER TABLE `content_redirects` RENAME INDEX `content_redirects_active_source_idx` TO `content_redirects_is_active_source_path_idx`;

-- RenameIndex
ALTER TABLE `content_relations` RENAME INDEX `content_relations_source_target_type_key` TO `content_relations_source_uuid_target_uuid_relation_type_key`;

-- RenameIndex
ALTER TABLE `content_relations` RENAME INDEX `content_relations_source_type_order_idx` TO `content_relations_source_uuid_relation_type_sort_order_idx`;

-- RenameIndex
ALTER TABLE `content_relations` RENAME INDEX `content_relations_target_type_idx` TO `content_relations_target_uuid_relation_type_idx`;

-- RenameIndex
ALTER TABLE `content_revisions` RENAME INDEX `content_revisions_entity_created_idx` TO `content_revisions_entity_type_entity_uuid_created_at_idx`;

-- RenameIndex
ALTER TABLE `content_revisions` RENAME INDEX `content_revisions_entity_version_key` TO `content_revisions_entity_type_entity_uuid_version_key`;

-- RenameIndex
ALTER TABLE `content_seo` RENAME INDEX `content_seo_entity_key` TO `content_seo_entity_type_entity_uuid_key`;

-- RenameIndex
ALTER TABLE `content_tags` RENAME INDEX `content_tags_deletedAt_idx` TO `content_tags_deleted_at_idx`;

-- RenameIndex
ALTER TABLE `content_testimonials` RENAME INDEX `content_testimonials_status_language_sort_idx` TO `content_testimonials_status_language_sort_order_id_idx`;

-- RenameIndex
ALTER TABLE `countries` RENAME INDEX `countries_active_deleted_sort_idx` TO `countries_is_active_deleted_at_sort_order_idx`;

-- RenameIndex
ALTER TABLE `crm_contact_relationships` RENAME INDEX `crm_contact_rel_from_to_type_key` TO `crm_contact_relationships_fromContactId_toContactId_relation_key`;

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

-- RenameIndex
ALTER TABLE `system_export_jobs` RENAME INDEX `system_export_jobs_actor_created_idx` TO `system_export_jobs_actor_uuid_created_at_idx`;

-- RenameIndex
ALTER TABLE `system_export_jobs` RENAME INDEX `system_export_jobs_download_token_idx` TO `system_export_jobs_download_token_hash_idx`;

-- RenameIndex
ALTER TABLE `system_export_jobs` RENAME INDEX `system_export_jobs_state_expires_idx` TO `system_export_jobs_state_expires_at_idx`;

-- RenameIndex
ALTER TABLE `system_import_jobs` RENAME INDEX `system_import_jobs_actor_created_idx` TO `system_import_jobs_actor_uuid_created_at_idx`;

-- RenameIndex
ALTER TABLE `system_import_jobs` RENAME INDEX `system_import_jobs_actor_idempotency_key_key` TO `system_import_jobs_actor_uuid_idempotency_key_key`;

-- RenameIndex
ALTER TABLE `system_import_jobs` RENAME INDEX `system_import_jobs_state_expires_idx` TO `system_import_jobs_state_expires_at_idx`;

-- RenameIndex
ALTER TABLE `system_integration_conflicts` RENAME INDEX `system_integration_conflicts_conflict_key` TO `system_integration_conflicts_integration_id_conflict_key_key`;

-- RenameIndex
ALTER TABLE `system_integration_credentials` RENAME INDEX `system_integration_credentials_expiry_idx` TO `system_integration_credentials_access_token_expires_at_idx`;

-- RenameIndex
ALTER TABLE `system_integration_credentials` RENAME INDEX `system_integration_credentials_refresh_expires_idx` TO `system_integration_credentials_refresh_token_expires_at_idx`;

-- RenameIndex
ALTER TABLE `system_integration_credentials` RENAME INDEX `system_integration_credentials_type_version_key` TO `system_integration_credentials_integration_id_credential_typ_key`;

-- RenameIndex
ALTER TABLE `system_integration_events` RENAME INDEX `system_integration_events_event_key` TO `system_integration_events_integration_id_event_key_key`;

-- RenameIndex
ALTER TABLE `system_integration_events` RENAME INDEX `system_integration_events_status_idx` TO `system_integration_events_integration_id_status_occurred_at_idx`;

-- RenameIndex
ALTER TABLE `system_integration_idempotency` RENAME INDEX `system_integration_idempotency_identity_key` TO `system_integration_idempotency_integration_id_event_key_even_key`;

-- RenameIndex
ALTER TABLE `system_integration_operations` RENAME INDEX `system_integration_operations_idempotency_key` TO `system_integration_operations_integration_id_idempotency_key_key`;

-- RenameIndex
ALTER TABLE `system_integration_operations` RENAME INDEX `system_integration_operations_state_idx` TO `system_integration_operations_integration_id_state_next_atte_idx`;

-- RenameIndex
ALTER TABLE `system_integration_runtime` RENAME INDEX `system_integration_runtime_circuit_idx` TO `system_integration_runtime_circuit_state_next_retry_at_idx`;

-- RenameIndex
ALTER TABLE `system_integration_runtime` RENAME INDEX `system_integration_runtime_integration_key` TO `system_integration_runtime_integration_id_key`;

-- RenameIndex
ALTER TABLE `system_integrations` RENAME INDEX `system_integrations_provider_version_key` TO `system_integrations_provider_key_provider_version_key`;

-- RenameIndex
ALTER TABLE `system_operational_alerts` RENAME INDEX `system_operational_alerts_status_idx` TO `system_operational_alerts_status_severity_last_seen_at_idx`;

-- RenameIndex
ALTER TABLE `system_webhook_deliveries` RENAME INDEX `system_webhook_deliveries_subscription_created_at_idx` TO `system_webhook_deliveries_subscription_id_created_at_idx`;
