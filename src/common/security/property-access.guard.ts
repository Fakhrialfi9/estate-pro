import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import {
  PROPERTY_ACCESS_QUERY,
  type PropertyAccessQuery,
} from './property-access.port.js';

type PropertyAccessRequest = {
  method?: string;
  user?: { sub?: string; permissions?: readonly string[] };
  params: Record<string, string | undefined>;
  path?: string;
  originalUrl?: string;
  url?: string;
  route?: { path?: string };
};

const normalizePermission = (value: string): string =>
  value.trim().replace(/:/g, '.');

const hasGlobalPropertyAccess = (
  permissions: readonly string[] | undefined,
): boolean => {
  const granted = new Set((permissions ?? []).map(normalizePermission));
  return (
    granted.has('properties.manage') ||
    granted.has('listings.manage') ||
    granted.has('property.manage')
  );
};

const requestPathOf = (request: PropertyAccessRequest): string =>
  request.path ??
  request.route?.path ??
  request.originalUrl ??
  request.url ??
  '';

@Injectable()
export class PropertyAccessGuard implements CanActivate {
  constructor(
    @Inject(PROPERTY_ACCESS_QUERY)
    private readonly propertyAccess: PropertyAccessQuery,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PropertyAccessRequest>();
    const principalUuid = request.user?.sub;
    if (!principalUuid) throw new ForbiddenException();

    const routePath = requestPathOf(request);
    const isListingResource = routePath.includes('/listings/');
    const isPropertyResource =
      routePath.includes('/properties/') || routePath.includes('/read-model/');

    if (!isListingResource && !isPropertyResource) return true;
    if (hasGlobalPropertyAccess(request.user?.permissions)) return true;

    const directPropertyUuid = request.params.propertyUuid;
    const pathUuid = request.params.uuid;

    if (isListingResource && !pathUuid) throw new ForbiddenException();
    const propertyUuid = directPropertyUuid ?? pathUuid;
    if (!propertyUuid) throw new ForbiddenException();

    const accessible = isListingResource
      ? await this.propertyAccess.canAccessListing({
          principalUuid,
          listingUuid: pathUuid as string,
        })
      : await this.propertyAccess.canAccessProperty({
          principalUuid,
          propertyUuid,
          includeDeleted:
            request.method === 'GET' || routePath.includes('/restore'),
        });

    if (!accessible) throw new ForbiddenException();
    return true;
  }
}
