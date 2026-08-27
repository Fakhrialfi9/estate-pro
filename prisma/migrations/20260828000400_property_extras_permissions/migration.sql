INSERT INTO authorization_permissions (uuid,name,code,module,domain,action,created_at,updated_at) VALUES
(UUID(),'Read Property Utilities','property-utilities.read','property','property-utilities','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Utilities','property-utilities.update','property','property-utilities','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Legal','property-legal.read','property','property-legal','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Legal','property-legal.update','property','property-legal','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Certificates','property-certificates.read','property','property-certificates','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Create Property Certificates','property-certificates.create','property','property-certificates','create',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Certificates','property-certificates.update','property','property-certificates','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Delete Property Certificates','property-certificates.delete','property','property-certificates','delete',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Financial','property-financial.read','property','property-financial','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Financial','property-financial.update','property','property-financial','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Features','property-features.read','property','property-features','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Features','property-features.update','property','property-features','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Security','property-security.read','property','property-security','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Security','property-security.update','property','property-security','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Environment','property-environment.read','property','property-environment','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Environment','property-environment.update','property','property-environment','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property SEO','property-seo.read','property','property-seo','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property SEO','property-seo.update','property','property-seo','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Property Media','property-media.read','property','property-media','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Create Property Media','property-media.create','property','property-media','create',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Update Property Media','property-media.update','property','property-media','update',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Delete Property Media','property-media.delete','property','property-media','delete',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Set Property Media Cover','property-media.set-cover','property','property-media','set-cover',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Reorder Property Media','property-media.reorder','property','property-media','reorder',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));
INSERT INTO authorization_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3) FROM authorization_roles r CROSS JOIN authorization_permissions p
WHERE r.code='ADMIN' AND p.code IN ('property-utilities.read','property-utilities.update','property-legal.read','property-legal.update','property-certificates.read','property-certificates.create','property-certificates.update','property-certificates.delete','property-financial.read','property-financial.update','property-features.read','property-features.update','property-security.read','property-security.update','property-environment.read','property-environment.update','property-seo.read','property-seo.update','property-media.read','property-media.create','property-media.update','property-media.delete','property-media.set-cover','property-media.reorder')
AND NOT EXISTS (SELECT 1 FROM authorization_role_permissions x WHERE x.role_id=r.id AND x.permission_id=p.id);
