import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import {
  PrismaListingRepository,
  ListingConflictError,
} from '../../src/modules/property/listing/infrastructure/listing.repository.js';

let moduleRef: TestingModule;
let prisma: PrismaService;
let repository: PrismaListingRepository;
let propertyUuid: string;
let listingUuid: string;
