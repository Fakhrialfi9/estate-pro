import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';

type PropertyAccessRequest = Request & {
  user?: { sub?: string; permissions?: readonly string[] };
  params: Record<string, string | undefined>;
};

const normalizePermission = (value: string): string =>
  value.trim().replace(/:/g, '.');

const hasGlobalPropertyAccess = (
  permissions: readonly string[] | undefined,
): boolean => {
  const granted = new Set(
    (permissions ?? []).map(normalizePermission),
  );
  return (
    granted.has('properties.manage') ||
    granted.has('listings.manage') ||
    granted.has('property.manage')
  );
};

@Injectable()
export class PropertyAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PropertyAccessRequest>();
    const principalUuid = request.user?.sub;
    if (!principalUuid) throw new ForbiddenException();

    const routePath = String(request.route?.path ?? request.path ?? '');
    const isListingResource = routePath.includes('/listings/:uuid');
    const isPropertyResource =
      routePath.includes('/properties/:uuid') ||
      routePath.includes('/properties/:propertyUuid') ||
      routePath.includes('/read-model/:uuid');

    if (!isListingResource && !isPropertyResource) return true;
    if (hasGlobalPropertyAccess(request.user?.permissions)) return true;

    const directPropertyUuid = request.params.propertyUuid;
    const pathUuid = request.params.uuid;

    const accessible = isListingResource
      ? await this.prisma.propertyListing.findFirst({
          where: {
            uuid: pathUuid,
            property: {
              deletedAt: null,
              OR: [
                { createdBy: principalUuid },
                {
                  agentAssignments: {
                    some: {
                      agentUserUuid: principalUuid,
                      unassignedAt: null,
                    },
                  },
                },
              ],
            },
          },
          select: { id: true },
        })
      : await this.prisma.property.findFirst({
          where: {
            uuid: directPropertyUuid ?? pathUuid,
            deletedAt: null,
            OR: [
              { createdBy: principalUuid },
              {
                agentAssignments: {
                  some: {
                    agentUserUuid: principalUuid,
                    unassignedAt: null,
                  },
                },
              },
            ],
          },
          select: { id: true },
        });

    if (!accessible) throw new ForbiddenException();
    return true;
  }
}
