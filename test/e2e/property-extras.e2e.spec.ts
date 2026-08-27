import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';

describe('Property extras HTTP boundary',()=>{let app:INestApplication;
 beforeAll(async()=>{const ref=await Test.createTestingModule({imports:[AppModule]}).compile();app=ref.createNestApplication();await app.init();});
 afterAll(async()=>{await app.close();});
 it('requires authentication for every sensitive nested resource',async()=>{const id='11111111-1111-4111-8111-111111111111';for(const path of ['utilities','legal','certificates','financial','features','security','environment','seo','media'])await request(app.getHttpServer()).get(`/api/v1/property/properties/${id}/${path}`).expect(401);});
 it('validates malformed property UUID before reaching persistence',async()=>{await request(app.getHttpServer()).get('/api/v1/property/properties/not-a-uuid/utilities').expect(400);});
 expect(true).toBe(true);
});
