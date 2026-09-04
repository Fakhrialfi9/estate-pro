import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service.js';
import type { PropertyAccessQuery } from '../../common/security/property-access.port.js';

@Injectable()
export class PrismaPropertyAccessQuery implements PropertyAccessQuery {
  constructor(private readonly prisma: PrismaService) {}

  async canAccessProperty(input: {
    principalUuid: string;
    propertyUuid: string;
    includeDeleted: boolean;
  }): Promise<boolean> {
    const record = await this.prisma.property.findFirst({
      where: {
        uuid: input.propertyUuid,
        ...(input.includeDeleted ? {} : { deletedAt: null }),
        OR: [
          { createdBy: input.principalUuid },
          {
            agentAssignments: {
              some: {
                agentUserUuid: input.principalUuid,
                unassignedAt: null,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    return record !== null;
  }

  async canAccessListing(input: {
    principalUuid: string;
    listingUuid: string;
  }): Promise<boolean> {
    const record = await this.prisma.propertyListing.findFirst({
      where: {
        uuid: input.listingUuid,
        property: {
          deletedAt: null,
          OR: [
            { createdBy: input.principalUuid },
            {
              agentAssignments: {
                some: {
                  agentUserUuid: input.principalUuid,
                  unassignedAt: null,
                },
              },
            },
          ],
        },
      },
      select: { id: true },
    });

    return record !== null;
  }
}
