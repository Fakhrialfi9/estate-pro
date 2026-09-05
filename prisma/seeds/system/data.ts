export const SYSTEM_SETTINGS = [
  ['system.default_page_size', 'GLOBAL', 'global', 'INTEGER', '25'],
  ['system.max_page_size', 'GLOBAL', 'global', 'INTEGER', '100'],
  ['system.maintenance_mode', 'GLOBAL', 'global', 'BOOLEAN', 'false'],
  ['system.default_timezone', 'GLOBAL', 'global', 'STRING', 'Asia/Jakarta'],
] as const;

export const FEATURE_FLAGS = [
  ['dashboard.executive', 'development', true, 100],
  ['crm.lead-scoring', 'development', true, 100],
  ['property.matching', 'development', true, 100],
] as const;

export const IMPORT_PROFILES = [
  { name: 'Property CSV v1', entity: 'property', format: 'CSV', conflictStrategy: 'FAIL', transactionStrategy: 'ROW', columnMapping: { businessCode: 'business_code', title: 'title', slug: 'slug' }, fieldMapping: { businessCode: 'businessCode', title: 'title', slug: 'slug' } },
  { name: 'CRM Contact CSV v1', entity: 'crm_contact', format: 'CSV', conflictStrategy: 'UPDATE', transactionStrategy: 'ROW', columnMapping: { email: 'email', firstName: 'first_name', lastName: 'last_name' }, fieldMapping: { email: 'email', firstName: 'firstName', lastName: 'lastName' } },
] as const;

export const INTEGRATIONS = [
  { providerKey: 'PROPERTY_PORTAL', providerVersion: '1.0', state: 'ACTIVE', capabilities: ['PROPERTY_EXPORT', 'LISTING_SYNC'], metadata: { environment: 'development' } },
] as const;

export const ALERT_RULES = [
  ['integration.sync.failure', 'INTEGRATION_SYNC_FAILURE', 'HIGH', 3, 300, 900],
  ['integration.circuit.open', 'INTEGRATION_CIRCUIT_OPEN', 'CRITICAL', 1, 60, 600],
] as const;
