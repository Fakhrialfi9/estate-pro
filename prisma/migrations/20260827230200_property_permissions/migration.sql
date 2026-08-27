INSERT INTO authorization_permissions (uuid,name,code,module,domain,action,created_at,updated_at) VALUES
(UUID(),'Create Property Categories','property-categories.create','property','property-categories','create',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Categories','property-categories.read','property','property-categories','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Categories','property-categories.update','property','property-categories','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Delete Property Categories','property-categories.delete','property','property-categories','delete',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Create Property Subcategories','property-subcategories.create','property','property-subcategories','create',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Subcategories','property-subcategories.read','property','property-subcategories','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Subcategories','property-subcategories.update','property','property-subcategories','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Delete Property Subcategories','property-subcategories.delete','property','property-subcategories','delete',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Manage Locations','locations.manage','property','locations','manage',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Locations','locations.read','property','locations','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Create Facilities','facilities.create','property','facilities','create',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Facilities','facilities.read','property','facilities','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Facilities','facilities.update','property','facilities','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Delete Facilities','facilities.delete','property','facilities','delete',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Create Properties','properties.create','property','properties','create',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Properties','properties.read','property','properties','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Properties','properties.update','property','properties','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Delete Properties','properties.delete','property','properties','delete',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));

INSERT INTO authorization_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3) FROM authorization_roles r CROSS JOIN authorization_permissions p
WHERE r.code='ADMIN' AND p.code IN ('property-categories.create','property-categories.read','property-categories.update','property-categories.delete','property-subcategories.create','property-subcategories.read','property-subcategories.update','property-subcategories.delete','locations.manage','locations.read','facilities.create','facilities.read','facilities.update','facilities.delete','properties.create','properties.read','properties.update','properties.delete')
AND NOT EXISTS (SELECT 1 FROM authorization_role_permissions x WHERE x.role_id=r.id AND x.permission_id=p.id);
