import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

type SupertestApp = Parameters<typeof request>[0];

export const httpRequest = (app: INestApplication) =>
  request(app.getHttpServer() as SupertestApp);
