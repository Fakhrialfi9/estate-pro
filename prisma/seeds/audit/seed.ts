import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';

const ADMIN_UUID = '00000000-0000-5000-8000-000000000001';

export async function seedAudit(tx: SeedTransaction): Promise<void> {
  const propertyId = await tx.property.findUnique({ where: { businessCode: 'PROP-DGO-001' }, select: { id: true, uuid: true } });
  if (!propertyId) throw new Error('Missing property fixture for audit seed');

  const audit = await tx.auditLog.upsert({
    where: { uuid: seedUuid('audit-log', 'seed-property-bootstrap') },
    update: { userId: null, action: 'SEED_BOOTSTRAP', entityType: 'PROPERTY', entityId: propertyId.id, ipAddress: '127.0.0.1', userAgent: 'prisma-seed', requestId: seedUuid('request', 'seed-property-bootstrap'), actorUserId: await tx.authenticationUser.findUniqueOrThrow({ where: { uuid: ADMIN_UUID }, select: { id: true } }).then(({ id }) => id), actorType: 'SYSTEM', resourceId: propertyId.uuid, result: 'SUCCESS', reason: 'Deterministic development fixture' },
    create: { uuid: seedUuid('audit-log', 'seed-property-bootstrap'), action: 'SEED_BOOTSTRAP', entityType: 'PROPERTY', entityId: propertyId.id, ipAddress: '127.0.0.1', userAgent: 'prisma-seed', requestId: seedUuid('request', 'seed-property-bootstrap'), actorUserId: await tx.authenticationUser.findUniqueOrThrow({ where: { uuid: ADMIN_UUID }, select: { id: true } }).then(({ id }) => id), actorType: 'SYSTEM', resourceId: propertyId.uuid, result: 'SUCCESS', reason: 'Deterministic development fixture', createdAt: SEED_REFERENCE_DATE },
  });
  await tx.auditLogChange.deleteMany({ where: { auditLogId: audit.id } });
  await tx.auditLogChange.create({ data: { auditLogId: audit.id, field: 'seeded', oldValue: null, newValue: true, createdAt: SEED_REFERENCE_DATE } });
}
