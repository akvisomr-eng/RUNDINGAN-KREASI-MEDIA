-- Internal platform module used by shared ERP transactions; hidden from client plugin catalog.
INSERT INTO module_catalog(code,name,description,is_optional,default_enabled)
VALUES('ENTERPRISE','Enterprise Operations','Internal shared ERP and finance operations; not a customer-selectable plugin.',false,true)
ON CONFLICT(code) DO NOTHING;
INSERT INTO organization_modules(organization_id,module_code,status)
SELECT id,'ENTERPRISE','active' FROM organizations WHERE slug='rundingan-kreasi-media'
ON CONFLICT(organization_id,module_code) DO NOTHING;
INSERT INTO schema_migrations(version,description,applied_at)
VALUES('20261104_005_enterprise_transaction_module','Add internal Enterprise transaction namespace for shared ERP workflows',NOW())
ON CONFLICT(version) DO NOTHING;
