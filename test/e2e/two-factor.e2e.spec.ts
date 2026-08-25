import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response as SuperTestResponse } from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';
import { TotpService } from '../../src/modules/auth/application/services/totp.service.js';
import { JwtService } from '@nestjs/jwt';

const PASSWORD = 'Strong-Test-Password-123!';

type AccessTokenResponse = { accessToken: string };
type EnrollmentResponse = {
  method: 'totp';
  verificationRequired: boolean;
  provisioningUri: string;
};
type EnrollmentEnabledResponse = {
  enabled: boolean;
  recoveryCodes: string[];
};
type MfaChallengeResponse = {
  mfaRequired: boolean;
  challengeToken: string;
};
type MfaCompletedResponse = { accessToken: string };
type TwoFactorStatusResponse = { enabled: boolean };

let app: NestExpressApplication;
let prisma: PrismaService;
let hasher: PasswordHasherService;
let totp: TotpService;
let jwt: JwtService;
let userUuid = '';

const httpRequest = () => request(app.getHttpServer());
const bodyOf = <T>(response: SuperTestResponse): T =>
  response.body as unknown as T;

async function cleanup(): Promise<void> {
  await prisma.auditLogChange.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.authenticationUserTwoFactorChallenge.deleteMany();
  await prisma.authenticationUserTwoFactorRecoveryCode.deleteMany();
  await prisma.authenticationUserTwoFactor.deleteMany();
  await prisma.authenticationUserSession.deleteMany();
  await prisma.authenticationUserCredential.deleteMany();
  await prisma.authenticationUserSecurity.deleteMany();
  await prisma.authorizationUserRole.deleteMany();
  await prisma.authenticationUser.deleteMany();
}

async function createUser(): Promise<void> {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email: `2fa-${randomUUID()}@example.com`,
      status: 'active',
      isActive: true,
      isVerified: true,
    },
  });
  userUuid = user.uuid;
  await prisma.authenticationUserCredential.create({
    data: { userId: user.id, passwordHash: await hasher.hash(PASSWORD) },
  });
  await prisma.authenticationUserSecurity.create({ data: { userId: user.id } });
}

describe('Two-factor and recovery E2E', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    hasher = app.get(PasswordHasherService);
    totp = app.get(TotpService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await cleanup();
    await createUser();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('enrolls and verifies TOTP, persists recovery codes, requires MFA at login, and consumes a recovery code once', async () => {
    const loginUser = await prisma.authenticationUser.findUniqueOrThrow({
      where: { uuid: userUuid },
    });
    const login = await httpRequest()
      .post('/api/v1/auth/login')
      .send({ identifier: loginUser.email, password: PASSWORD })
      .expect(201);
    const token = bodyOf<AccessTokenResponse>(login).accessToken;
    expect(token).toEqual(expect.any(String));

    const enrollment = await httpRequest()
      .post('/api/v1/auth/2fa/enrollment')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const enrollmentBody = bodyOf<EnrollmentResponse>(enrollment);
    expect(enrollmentBody.method).toBe('totp');
    expect(enrollmentBody.verificationRequired).toBe(true);
    const uri = new URL(enrollmentBody.provisioningUri);
    const secret = uri.searchParams.get('secret');
    expect(secret).toEqual(expect.any(String));

    const code = totp.generateCode(secret!, totp.currentTimeStep());
    const enabled = await httpRequest()
      .post('/api/v1/auth/2fa/enrollment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code })
      .expect(201);
    const enabledBody = bodyOf<EnrollmentEnabledResponse>(enabled);
    expect(enabledBody.enabled).toBe(true);
    expect(enabledBody.recoveryCodes).toHaveLength(10);
    const recoveryCode = enabledBody.recoveryCodes[0];
    expect(recoveryCode).toMatch(/^[0-9a-f]{32}$/);

    const status = await httpRequest()
      .get('/api/v1/auth/2fa')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(bodyOf<TwoFactorStatusResponse>(status).enabled).toBe(true);

    const mfaLogin = await httpRequest()
      .post('/api/v1/auth/login')
      .send({ identifier: loginUser.email, password: PASSWORD })
      .expect(201);
    const mfaLoginBody = bodyOf<MfaChallengeResponse>(mfaLogin);
    expect(mfaLoginBody.mfaRequired).toBe(true);
    expect(mfaLoginBody.challengeToken).toEqual(expect.any(String));

    const completed = await httpRequest()
      .post('/api/v1/auth/2fa/verify')
      .send({ challengeToken: mfaLoginBody.challengeToken, recoveryCode })
      .expect(201);
    expect(bodyOf<MfaCompletedResponse>(completed).accessToken).toEqual(
      expect.any(String),
    );

    const secondChallenge = await httpRequest()
      .post('/api/v1/auth/login')
      .send({ identifier: loginUser.email, password: PASSWORD })
      .expect(201);
    const secondChallengeBody = bodyOf<MfaChallengeResponse>(secondChallenge);
    await httpRequest()
      .post('/api/v1/auth/2fa/verify')
      .send({
        challengeToken: secondChallengeBody.challengeToken,
        recoveryCode,
      })
      .expect(401);

    expect(
      await prisma.authenticationUserTwoFactor.count({
        where: { userId: loginUser.id },
      }),
    ).toBe(1);
    expect(
      await prisma.authenticationUserTwoFactorRecoveryCode.count({
        where: { userId: loginUser.id },
      }),
    ).toBe(10);
    expect(
      await prisma.authenticationUserTwoFactorChallenge.count({
        where: { userId: loginUser.id },
      }),
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: { action: '2FA_ENABLED', userId: loginUser.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: '2FA_RECOVERY_CODE_USED', userId: loginUser.id },
      }),
    ).toBe(1);
  });

  it('rejects invalid enrollment codes without enabling 2FA', async () => {
    const loginUser = await prisma.authenticationUser.findUniqueOrThrow({
      where: { uuid: userUuid },
    });
    const login = await httpRequest()
      .post('/api/v1/auth/login')
      .send({ identifier: loginUser.email, password: PASSWORD })
      .expect(201);
    const token = bodyOf<AccessTokenResponse>(login).accessToken;
    await httpRequest()
      .post('/api/v1/auth/2fa/enrollment')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    await httpRequest()
      .post('/api/v1/auth/2fa/enrollment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' })
      .expect(401);
    expect(
      await prisma.authenticationUserTwoFactor.findFirst({
        where: { userId: loginUser.id, enabledAt: { not: null } },
      }),
    ).toBeNull();
  });

  it('keeps MFA challenge tokens invalid outside their purpose', async () => {
    const malformed = jwt.sign({ sub: userUuid, sid: randomUUID() });
    await httpRequest()
      .post('/api/v1/auth/2fa/verify')
      .send({ challengeToken: malformed, code: '000000' })
      .expect(401);
  });
});
