export interface CrmActor {
  readonly actorUuid: string;
  readonly permissions?: readonly string[];
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface PageQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly search?: string;
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
  readonly [key: string]: unknown;
}

export const pageOf = (
  query: PageQuery,
): { page: number; limit: number; skip: number } => {
  const page =
    Number.isInteger(query.page) && (query.page ?? 1) > 0
      ? (query.page ?? 1)
      : 1;
  const limit = Number.isInteger(query.limit)
    ? Math.min(100, Math.max(1, query.limit ?? 20))
    : 20;
  return { page, limit, skip: (page - 1) * limit };
};

export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase();

export const normalizePhone = (value: string): string =>
  value.replace(/[^0-9+]/g, '').trim();

export const normalizeText = (value: string, max: number): string =>
  value
    .normalize('NFKC')
    .replace(/[\p{Cc}]/gu, '')
    .trim()
    .slice(0, max);

export const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
};

export const assertPlainText = (value: string): void => {
  if (/[<>]/.test(value) || /javascript\s*:/i.test(value))
    throw new Error('HTML or executable URL content is not allowed');
};

export const assertLeadStatusTransition = (
  from: { code: string },
  to: { code: string },
): void => {
  if (from.code === to.code) return;
  const blocked = new Set(['CLOSED_WON', 'CLOSED_LOST', 'ARCHIVED']);
  if (blocked.has(from.code))
    throw new Error(`Lead cannot transition from ${from.code}`);
  if (
    to.code === 'QUALIFIED' &&
    !['NEW', 'CONTACTED', 'NURTURING'].includes(from.code)
  )
    throw new Error(`Invalid transition ${from.code} -> ${to.code}`);
};

export interface ScoreInput {
  readonly values: Readonly<Record<string, unknown>>;
}

export interface ScoreRule {
  readonly code: string;
  readonly field: string;
  readonly operator: string;
  readonly value: string;
  readonly points: number;
}

export const matchesScoreRule = (
  input: ScoreInput,
  rule: ScoreRule,
): boolean => {
  const actual = input.values[rule.field];
  if (actual === null || actual === undefined) return false;
  const expected = rule.value;
  switch (rule.operator) {
    case 'EQ':
      return toText(actual).toLowerCase() === expected.toLowerCase();
    case 'NEQ':
      return toText(actual).toLowerCase() !== expected.toLowerCase();
    case 'CONTAINS':
      return toText(actual).toLowerCase().includes(expected.toLowerCase());
    case 'GT':
      return Number(actual) > Number(expected);
    case 'GTE':
      return Number(actual) >= Number(expected);
    case 'LT':
      return Number(actual) < Number(expected);
    case 'LTE':
      return Number(actual) <= Number(expected);
    case 'TRUE':
      return actual === true;
    case 'FALSE':
      return actual === false;
    default:
      return false;
  }
};

export const calculateScore = (
  input: ScoreInput,
  rules: readonly ScoreRule[],
): {
  score: number;
  factors: readonly { code: string; points: number; explanation: string }[];
} => {
  const factors = rules
    .filter((rule) => matchesScoreRule(input, rule))
    .map((rule) => ({
      code: rule.code,
      points: rule.points,
      explanation: `${rule.field} ${rule.operator} ${rule.value}`,
    }));
  return {
    score: factors.reduce((sum, factor) => sum + factor.points, 0),
    factors,
  };
};

export const duplicatePairKey = (a: string, b: string): string =>
  [a, b].sort().join(':');
