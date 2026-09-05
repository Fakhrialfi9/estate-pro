import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';

const ADMIN_UUID = '00000000-0000-5000-8000-000000000001';

export async function seedAudit(tx: SeedTransaction): Promise<void> {
  const [property, admin] = await Promise.all([
    tx.property.findUnique({ where: { businessCode: 'PROP-DGO-001' }, select: { id: true, uuid: true } }),
    tx.authenticationUser.findUnique({ where: { uuid: ADMIN_UUID }, select: { id: true } }),
  ]);
  if (!property || !admin) throw new Error('Missing property/admin fixture for audit seed');

  const audit = await tx.auditLog.upsert({
    where: { uuid: seedUuid('audit-log', 'seed-property-bootstrap') },
    update: { userId: null, action: 'SEED_BOOTSTRAP', entityType: 'PROPERTY', entityId: property.id, ipAddress: '127.0.0.1', userAgent: 'prisma-seed', requestId: seedUuid('request', 'seed-property-bootstrap'), actorUserId: admin.id, actorType: 'SYSTEM', resourceId: property.uuid, result: 'SUCCESS', reason: 'Deterministic development fixture' },
    create: { uuid: seedUuid('audit-log', 'seed-property-bootstrap'), action: 'SEED_BOOTSTRAP', entityType: 'PROPERTY', entityId: property.id, ipAddress: '127.0.0.1', userAgent: 'prisma-seed', requestId: seedUuid('request', 'seed-property-bootstrap'), actorUserId: admin.id, actorType: 'SYSTEM', resourceId: property.uuid, result: 'SUCCESS', reason: 'Deterministic development fixture', createdAt: SEED_REFERENCE_DATE },
  });
  await tx.auditLogChange.deleteMany({ where: { auditLogId: audit.id } });
  await tx.auditLogChange.create({ data: { auditLogId: audit.id, field: 'seeded', oldValue: null, newValue: true, createdAt: SEED_REFERENCE_DATE } });
}
