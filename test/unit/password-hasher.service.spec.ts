import { ConfigService } from '@nestjs/config';

import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';

describe('PasswordHasherService', () => {
  const configService = new ConfigService({
    auth: {
      passwordHashing: {
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      },
    },
  });

  it('hashes passwords with Argon2id and never returns the plaintext', async () => {
    const service = new PasswordHasherService(configService);
    const password = 'Correct Horse Battery Staple 2026';

    const passwordHash = await service.hash(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(passwordHash, password)).resolves.toBe(true);
    await expect(service.verify(passwordHash, 'wrong password')).resolves.toBe(
      false,
    );
  });

  it('generates different hashes for the same password because Argon2 salts each hash', async () => {
    const service = new PasswordHasherService(configService);
    const password = 'Correct Horse Battery Staple 2026';

    const firstHash = await service.hash(password);
    const secondHash = await service.hash(password);

    expect(firstHash).not.toBe(secondHash);
    await expect(service.verify(firstHash, password)).resolves.toBe(true);
    await expect(service.verify(secondHash, password)).resolves.toBe(true);
  });
});
