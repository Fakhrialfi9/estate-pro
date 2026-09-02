import type { AnalyticsGranularity } from './analytics.types.js';

export const METRIC_CATALOG = {
  leadVolume: { formula: 'COUNT(leads)', source: 'crm_leads', definition: 'Leads created in the requested reporting range.' },
  conversionRate: { formula: 'converted / eligible * 100', source: 'crm_leads + sales_opportunities + sales_deals', definition: 'Conversion percentage using the explicitly defined cohort denominator.' },
  expectedRevenue: { formula: 'SUM(opportunity.valueAmount * stage.probability / 100)', source: 'sales_opportunities + sales_pipeline_stages', definition: 'Probability-weighted open pipeline value.' },
  closedRevenue: { formula: 'SUM(deal.totalAmount) by closing date', source: 'sales_deals + sales_closings', definition: 'Realized revenue for deals with a closing record.' },
  leadAgeDays: { formula: 'DATEDIFF(cutoff, createdAt)', source: 'crm_leads', definition: 'Age of open leads at the report cutoff.' },
  cycleTimeDays: { formula: 'timestamp difference / 86400', source: 'lifecycle history', definition: 'Elapsed time between canonical lifecycle milestones.' },
  productivity: { formula: 'raw workload and conversion measures', source: 'CRM + Sales + Property + Agent', definition: 'Scorecard returns explainable components; no arbitrary weighted score is used.' },
  slaBreach: { formula: 'elapsed > configured threshold', source: 'CRM + Sales timestamps', definition: 'Records whose measured SLA clock exceeds its threshold.' },
} as const;

export const CANONICAL_GRANULARITY: readonly AnalyticsGranularity[] = ['day', 'week', 'month'];
