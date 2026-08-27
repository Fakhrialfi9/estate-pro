import { randomUUID, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { omitUndefined } from '../../../../common/omit-undefined.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  validateCertificateDates,
  validateMedia,
  validateSeoInvariants,
  validateUtilityInvariants,
  type CertificateCreateInput,
  type CertificateUpdateInput,
  type JsonValue,
  type LegalPatch,
  type MediaCreateInput,
  type MediaUpdateInput,
  type SeoPatch,
  type UtilityPatch,
} from '../../domain/property-extras.js';

export class PropertyExtrasNotFoundError extends Error {}
export class PropertyExtrasConflictError extends Error {}
export class PropertyExtrasInvalidStateError extends Error {}

// ... existing repository declarations and methods remain unchanged ...

  async upsertSeo(uuid: string, input: SeoPatch, a: PropertyExtrasActor) {
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const prop = await this.propertyRecord(tx, uuid);
        const c = await tx.propertySeo.findFirst({
          where: { propertyId: prop.id, deletedAt: null },
        });
        const m = {
          ...input,
          keywords: j(input.keywords),
          tags: j(input.tags),
          customFields: j(input.customFields),
          updatedBy: sid(a),
        };
        validateSeoInvariants(prop.slug, input);
        const data = omitUndefined(m);
        const r = c
          ? await tx.propertySeo.update({
              where: { id: c.id },
              data,
            })
          : await tx.propertySeo.create({
              data: omitUndefined({
                uuid: randomUUID(),
                propertyId: prop.id,
                createdBy: sid(a),
                ...data,
              }),
            });
        return this.seo(r);
      }),
    );
  }

// ... remaining existing repository methods ...
