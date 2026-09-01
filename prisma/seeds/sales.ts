import type { SeedTransaction } from './database.ts';

const DEFAULT_PIPELINE_UUID = '7f2d4f80-5c3e-4a20-94ee-12ec1f3a0101';

export async function seedSales(tx: SeedTransaction): Promise<void> {
  const pipeline = await tx.salesPipeline.upsert({
    where: { uuid: DEFAULT_PIPELINE_UUID },
    update: { name: 'Default Sales Pipeline', status: 'ACTIVE', sortOrder: 0 },
    create: {
      uuid: DEFAULT_PIPELINE_UUID,
      name: 'Default Sales Pipeline',
      status: 'ACTIVE',
      sortOrder: 0,
    },
  });

  const stages = [
    ['OPEN', 'Open', 10, false, 1],
    ['QUALIFIED', 'Qualified', 25, false, 2],
    ['NEGOTIATING', 'Negotiating', 60, false, 3],
    ['WON', 'Won', 100, true, 4],
    ['LOST', 'Lost', 0, true, 5],
  ] as const;

  for (const [code, name, probability, isTerminal, sortOrder] of stages) {
    await tx.salesPipelineStage.upsert({
      where: { pipelineUuid_code: { pipelineUuid: pipeline.uuid, code } },
      update: {
        name,
        probability,
        isTerminal,
        isActive: true,
        sortOrder,
      },
      create: {
        uuid: crypto.randomUUID(),
        pipelineUuid: pipeline.uuid,
        code,
        name,
        probability,
        isTerminal,
        isActive: true,
        sortOrder,
      },
    });
  }

  await tx.salesLostReason.upsert({
    where: { code: 'PRICE' },
    update: { name: 'Price / budget mismatch', isActive: true },
    create: {
      uuid: crypto.randomUUID(),
      code: 'PRICE',
      name: 'Price / budget mismatch',
      isActive: true,
    },
  });

  await tx.salesLostReason.upsert({
    where: { code: 'COMPETITOR' },
    update: { name: 'Lost to competitor', isActive: true },
    create: {
      uuid: crypto.randomUUID(),
      code: 'COMPETITOR',
      name: 'Lost to competitor',
      isActive: true,
    },
  });

  await tx.salesCommissionRule.upsert({
    where: { code: 'STANDARD_2_5' },
    update: {
      name: 'Standard 2.5%',
      ratePercent: '2.5000',
      isActive: true,
    },
    create: {
      uuid: crypto.randomUUID(),
      code: 'STANDARD_2_5',
      name: 'Standard 2.5%',
      ratePercent: '2.5000',
      isActive: true,
    },
  });
}
