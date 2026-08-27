ALTER TABLE `property_listings`
  DROP INDEX `property_listings_property_id_key`,
  ADD INDEX `property_listings_property_id_idx` (`property_id`);
