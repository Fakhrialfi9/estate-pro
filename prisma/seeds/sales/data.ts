export const SALES_PIPELINE = {
  uuid: '7f2d4f80-5c3e-4a20-94ee-12ec1f3a0101',
  name: 'Default Sales Pipeline',
  status: 'ACTIVE',
} as const;

export const SALES_STAGES = [
  ['OPEN', 'Open', 10, false, 1],
  ['QUALIFIED', 'Qualified', 25, false, 2],
  ['NEGOTIATING', 'Negotiating', 60, false, 3],
  ['WON', 'Won', 100, true, 4],
  ['LOST', 'Lost', 0, true, 5],
] as const;
