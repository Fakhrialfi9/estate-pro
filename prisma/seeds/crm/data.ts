export const LEAD_SOURCES = [
  { code: 'WEBSITE', name: 'Website', description: 'Inbound website enquiries.' },
  { code: 'REFERRAL', name: 'Referral', description: 'Client and partner referrals.' },
  { code: 'PROPERTY_PORTAL', name: 'Property Portal', description: 'Third-party property portals.' },
] as const;

export const LEAD_CAMPAIGNS = [
  { sourceCode: 'WEBSITE', code: 'WEBSITE_ORGANIC', name: 'Website Organic', startsAt: '2026-01-01', endsAt: '2026-12-31' },
  { sourceCode: 'REFERRAL', code: 'PARTNER_REFERRAL_2026', name: 'Partner Referral 2026', startsAt: '2026-01-01', endsAt: '2026-12-31' },
] as const;

export const LEAD_TYPES = [
  { code: 'BUYER', name: 'Buyer' },
  { code: 'TENANT', name: 'Tenant' },
  { code: 'INVESTOR', name: 'Investor' },
  { code: 'OWNER', name: 'Owner' },
] as const;

export const LEAD_TAGS = [
  { code: 'HOT', name: 'Hot Lead' },
  { code: 'FIRST_TIME_BUYER', name: 'First-time Buyer' },
  { code: 'INVESTOR', name: 'Investor' },
  { code: 'JAKARTA', name: 'Jakarta' },
  { code: 'BANDUNG', name: 'Bandung' },
] as const;

export const LEAD_SCORE_RULES = [
  { code: 'SOURCE_REFERRAL', field: 'source', operator: 'EQUALS', value: 'REFERRAL', points: 20, priority: 10 },
  { code: 'TYPE_INVESTOR', field: 'type', operator: 'EQUALS', value: 'INVESTOR', points: 15, priority: 20 },
  { code: 'STATUS_QUALIFIED', field: 'status', operator: 'EQUALS', value: 'QUALIFIED', points: 30, priority: 30 },
] as const;
