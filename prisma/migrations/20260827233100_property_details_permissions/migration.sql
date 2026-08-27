INSERT INTO authorization_permissions (uuid,name,code,module,domain,action,created_at,updated_at) VALUES
(UUID(),'Read Property Specifications','property-specifications.read','property','property-specifications','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Specifications','property-specifications.update','property','property-specifications','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Locations','property-locations.read','property','property-locations','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Locations','property-locations.update','property','property-locations','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Buildings','property-buildings.read','property','property-buildings','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Buildings','property-buildings.update','property','property-buildings','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Create Property Rooms','property-rooms.create','property','property-rooms','create',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Rooms','property-rooms.read','property','property-rooms','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Rooms','property-rooms.update','property','property-rooms','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Delete Property Rooms','property-rooms.delete','property','property-rooms','delete',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Reorder Property Rooms','property-rooms.reorder','property','property-rooms','reorder',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Facilities','property-facilities.read','property','property-facilities','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Attach Property Facilities','property-facilities.attach','property','property-facilities','attach',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Facilities','property-facilities.update','property','property-facilities','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Detach Property Facilities','property-facilities.detach','property','property-facilities','detach',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Bulk Attach Property Facilities','property-facilities.bulk-attach','property','property-facilities','bulk-attach',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));

INSERT INTO authorization_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
FROM authorization_roles r CROSS JOIN authorization_permissions p
WHERE r.code='ADMIN'
AND p.code IN (
  'property-specifications.read','property-specifications.update',
  'property-locations.read','property-locations.update',
  'property-buildings.read','property-buildings.update',
  'property-rooms.create','property-rooms.read','property-rooms.update','property-rooms.delete','property-rooms.reorder',
  'property-facilities.read','property-facilities.attach','property-facilities.update','property-facilities.detach','property-facilities.bulk-attach'
)
AND NOT EXISTS (
  SELECT 1 FROM authorization_role_permissions x
  WHERE x.role_id=r.id AND x.permission_id=p.id
);
