export const ANALYTICS_PERMISSIONS = [
  { name: 'Read Analytics', code: 'analytics.read', module: 'analytics', domain: 'analytics', action: 'read' },
  { name: 'Read All Analytics', code: 'analytics.read.all', module: 'analytics', domain: 'analytics', action: 'read.all' },
  { name: 'Read Revenue Analytics', code: 'analytics.revenue.read', module: 'analytics', domain: 'revenue', action: 'read' },
  { name: 'Export Analytics', code: 'analytics.export', module: 'analytics', domain: 'analytics', action: 'export' },
  { name: 'Forecast Analytics', code: 'analytics.forecast', module: 'analytics', domain: 'forecast', action: 'read' },
  { name: 'Manage Analytics', code: 'analytics.manage', module: 'analytics', domain: 'analytics', action: 'manage' },
] as const;
