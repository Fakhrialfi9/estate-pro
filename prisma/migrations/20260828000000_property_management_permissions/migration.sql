INSERT INTO authorization_permissions
    (uuid, name, code, module, domain, action, created_at, updated_at)
VALUES
    (UUID(), 'Create Property Types', 'property-types.create', 'property', 'property-types', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Types', 'property-types.read', 'property', 'property-types', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Types', 'property-types.update', 'property', 'property-types', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Types', 'property-types.delete', 'property', 'property-types', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Categories', 'property-categories.create', 'property', 'property-categories', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Categories', 'property-categories.read', 'property', 'property-categories', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Categories', 'property-categories.update', 'property', 'property-categories', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Categories', 'property-categories.delete', 'property', 'property-categories', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Subcategories', 'property-subcategories.create', 'property', 'property-subcategories', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Subcategories', 'property-subcategories.read', 'property', 'property-subcategories', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Subcategories', 'property-subcategories.update', 'property', 'property-subcategories', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Subcategories', 'property-subcategories.delete', 'property', 'property-subcategories', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Read Locations', 'locations.read', 'property', 'locations', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Manage Locations', 'locations.manage', 'property', 'locations', 'manage', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Facilities', 'facilities.create', 'property', 'facilities', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Facilities', 'facilities.read', 'property', 'facilities', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Facilities', 'facilities.update', 'property', 'facilities', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Facilities', 'facilities.delete', 'property', 'facilities', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Properties', 'properties.create', 'property', 'properties', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Properties', 'properties.read', 'property', 'properties', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Properties', 'properties.update', 'property', 'properties', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Properties', 'properties.delete', 'property', 'properties', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Verify Properties', 'properties.verify', 'property', 'properties', 'verify', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Publish Properties', 'properties.publish', 'property', 'properties', 'publish', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Specifications', 'property-specifications.create', 'property', 'property-specifications', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Specifications', 'property-specifications.read', 'property', 'property-specifications', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Specifications', 'property-specifications.update', 'property', 'property-specifications', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Specifications', 'property-specifications.delete', 'property', 'property-specifications', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Locations', 'property-locations.create', 'property', 'property-locations', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Locations', 'property-locations.read', 'property', 'property-locations', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Locations', 'property-locations.update', 'property', 'property-locations', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Locations', 'property-locations.delete', 'property', 'property-locations', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Buildings', 'property-buildings.create', 'property', 'property-buildings', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Buildings', 'property-buildings.read', 'property', 'property-buildings', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Buildings', 'property-buildings.update', 'property', 'property-buildings', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Buildings', 'property-buildings.delete', 'property', 'property-buildings', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Rooms', 'property-rooms.create', 'property', 'property-rooms', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Rooms', 'property-rooms.read', 'property', 'property-rooms', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Rooms', 'property-rooms.update', 'property', 'property-rooms', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Rooms', 'property-rooms.delete', 'property', 'property-rooms', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Facility Assignments', 'property-facilities.create', 'property', 'property-facilities', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Facility Assignments', 'property-facilities.read', 'property', 'property-facilities', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Facility Assignments', 'property-facilities.update', 'property', 'property-facilities', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Facility Assignments', 'property-facilities.delete', 'property', 'property-facilities', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Utilities', 'property-utilities.create', 'property', 'property-utilities', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Utilities', 'property-utilities.read', 'property', 'property-utilities', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Utilities', 'property-utilities.update', 'property', 'property-utilities', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Utilities', 'property-utilities.delete', 'property', 'property-utilities', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Legal Records', 'property-legal.create', 'property', 'property-legal', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Legal Records', 'property-legal.read', 'property', 'property-legal', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Legal Records', 'property-legal.update', 'property', 'property-legal', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Legal Records', 'property-legal.delete', 'property', 'property-legal', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Certificates', 'property-certificates.create', 'property', 'property-certificates', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Certificates', 'property-certificates.read', 'property', 'property-certificates', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Certificates', 'property-certificates.update', 'property', 'property-certificates', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Certificates', 'property-certificates.delete', 'property', 'property-certificates', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Financial Records', 'property-financial.create', 'property', 'property-financial', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Financial Records', 'property-financial.read', 'property', 'property-financial', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Financial Records', 'property-financial.update', 'property', 'property-financial', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Financial Records', 'property-financial.delete', 'property', 'property-financial', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Features', 'property-features.create', 'property', 'property-features', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Features', 'property-features.read', 'property', 'property-features', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Features', 'property-features.update', 'property', 'property-features', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Features', 'property-features.delete', 'property', 'property-features', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Security Records', 'property-security.create', 'property', 'property-security', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Security Records', 'property-security.read', 'property', 'property-security', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Security Records', 'property-security.update', 'property', 'property-security', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Security Records', 'property-security.delete', 'property', 'property-security', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Environment Records', 'property-environment.create', 'property', 'property-environment', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Environment Records', 'property-environment.read', 'property', 'property-environment', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Environment Records', 'property-environment.update', 'property', 'property-environment', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Environment Records', 'property-environment.delete', 'property', 'property-environment', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property SEO', 'property-seo.create', 'property', 'property-seo', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property SEO', 'property-seo.read', 'property', 'property-seo', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property SEO', 'property-seo.update', 'property', 'property-seo', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property SEO', 'property-seo.delete', 'property', 'property-seo', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Media', 'property-media.create', 'property', 'property-media', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Media', 'property-media.read', 'property', 'property-media', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Media', 'property-media.update', 'property', 'property-media', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Media', 'property-media.delete', 'property', 'property-media', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Property Agents', 'property-agents.create', 'property', 'property-agents', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Property Agents', 'property-agents.read', 'property', 'property-agents', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Property Agents', 'property-agents.update', 'property', 'property-agents', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Property Agents', 'property-agents.delete', 'property', 'property-agents', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Manage Property Owners', 'property-owners.manage', 'property', 'property-owners', 'manage', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),

    (UUID(), 'Create Listings', 'listings.create', 'property', 'listings', 'create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Read Listings', 'listings.read', 'property', 'listings', 'read', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Update Listings', 'listings.update', 'property', 'listings', 'update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Delete Listings', 'listings.delete', 'property', 'listings', 'delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    module = VALUES(module),
    domain = VALUES(domain),
    action = VALUES(action),
    updated_at = CURRENT_TIMESTAMP(3);

INSERT INTO authorization_role_permissions (role_id, permission_id, created_at, updated_at)
SELECT
    r.id,
    p.id,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM authorization_roles r
CROSS JOIN authorization_permissions p
WHERE r.code = 'ADMIN'
  AND p.module = 'property'
  AND p.code IN (
      'property-types.create', 'property-types.read', 'property-types.update', 'property-types.delete',
      'property-categories.create', 'property-categories.read', 'property-categories.update', 'property-categories.delete',
      'property-subcategories.create', 'property-subcategories.read', 'property-subcategories.update', 'property-subcategories.delete',
      'locations.read', 'locations.manage',
      'facilities.create', 'facilities.read', 'facilities.update', 'facilities.delete',
      'properties.create', 'properties.read', 'properties.update', 'properties.delete', 'properties.verify', 'properties.publish',
      'property-specifications.create', 'property-specifications.read', 'property-specifications.update', 'property-specifications.delete',
      'property-locations.create', 'property-locations.read', 'property-locations.update', 'property-locations.delete',
      'property-buildings.create', 'property-buildings.read', 'property-buildings.update', 'property-buildings.delete',
      'property-rooms.create', 'property-rooms.read', 'property-rooms.update', 'property-rooms.delete',
      'property-facilities.create', 'property-facilities.read', 'property-facilities.update', 'property-facilities.delete',
      'property-utilities.create', 'property-utilities.read', 'property-utilities.update', 'property-utilities.delete',
      'property-legal.create', 'property-legal.read', 'property-legal.update', 'property-legal.delete',
      'property-certificates.create', 'property-certificates.read', 'property-certificates.update', 'property-certificates.delete',
      'property-financial.create', 'property-financial.read', 'property-financial.update', 'property-financial.delete',
      'property-features.create', 'property-features.read', 'property-features.update', 'property-features.delete',
      'property-security.create', 'property-security.read', 'property-security.update', 'property-security.delete',
      'property-environment.create', 'property-environment.read', 'property-environment.update', 'property-environment.delete',
      'property-seo.create', 'property-seo.read', 'property-seo.update', 'property-seo.delete',
      'property-media.create', 'property-media.read', 'property-media.update', 'property-media.delete',
      'property-agents.create', 'property-agents.read', 'property-agents.update', 'property-agents.delete',
      'property-owners.manage',
      'listings.create', 'listings.read', 'listings.update', 'listings.delete'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM authorization_role_permissions x
      WHERE x.role_id = r.id
        AND x.permission_id = p.id
  );
