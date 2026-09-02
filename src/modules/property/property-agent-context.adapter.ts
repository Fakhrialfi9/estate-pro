import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type {
  PropertyAgentContext,
  PropertyAgentContextPort,
} from '../../common/contracts/property-agent-context.port.js';

@Injectable()
export class PrismaPropertyAgentContextAdapter
  implements PropertyAgentContextPort
{
  constructor(private readonly prisma: PrismaService) {}
  async getContext(propertyUuid: string): Promise<PropertyAgentContext | null> {
    const db = this.prisma as any;
    const property = await db.property.findFirst({
      where: { uuid: propertyUuid, deletedAt: null },
      include: {
        location: {
          include: {
            country: true,
            province: true,
            city: true,
            district: true,
            subdistrict: true,
          },
        },
      },
    });
    if (!property) return null;
    const location = property.location;
    return {
      propertyUuid: property.uuid,
      ...(location?.country?.uuid
        ? { countryUuid: location.country.uuid }
        : {}),
      ...(location?.province?.uuid
        ? { provinceUuid: location.province.uuid }
        : {}),
      ...(location?.city?.uuid ? { cityUuid: location.city.uuid } : {}),
      ...(location?.district?.uuid
        ? { districtUuid: location.district.uuid }
        : {}),
      ...(location?.subdistrict?.uuid
        ? { subdistrictUuid: location.subdistrict.uuid }
        : {}),
    };
  }
}
