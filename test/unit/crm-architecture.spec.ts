import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(path, 'utf8');

describe('CRM architecture boundaries', () => {
  it('keeps Prisma out of CRM domain code and exposes only public cross-context ports', async () => {
    const [entity, lifecycle, contactRepo, crmModule] = await Promise.all([
      read('src/modules/crm/domain/entities/contact.entity.ts'),
      read('src/modules/crm/domain/lifecycle.policy.ts'),
      read('src/modules/crm/domain/repositories/contact.repository.ts'),
      read('src/modules/crm/crm.module.ts'),
    ]);
    expect(entity).not.toMatch(/prisma/i);
    expect(lifecycle).not.toMatch(/prisma/i);
    expect(contactRepo).not.toMatch(/prisma/i);
    expect(crmModule).toContain('PropertyModule');
    expect(crmModule).toContain('UsersModule');
  });

  it('requires private CRM controllers to use authentication and authorization guards', async () => {
    const controller = await read(
      'src/modules/crm/presentation/crm.controller.ts',
    );
    const normalizedController = controller.replace(/\s+/g, '');
    expect(controller).toContain('JwtAuthGuard');
    expect(controller).toContain('AuthorizationGuard');
    expect(normalizedController).toContain("@Controller({path:'crm',version:'1'})");
    expect(controller).toContain("RequirePermissions('crm.contacts.read')");
  });
});
