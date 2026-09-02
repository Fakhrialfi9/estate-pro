import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type { PropertyRegionPort } from '../../common/contracts/property-region.port.js';

@Injectable()
export class PrismaPropertyRegionAdapter implements PropertyRegionPort {
  constructor(private readonly prisma: PrismaService) {}

  async isKnownRegion(uuid: string): Promise<boolean> {
    const [country, province, city, district, subdistrict] = await Promise.all([
      this.prisma.country.findFirst({ where: { uuid, deletedAt: null } }),
      this.prisma.province.findFirst({ where: { uuid, deletedAt: null } }),
      this.prisma.city.findFirst({ where: { uuid, deletedAt: null } }),
      this.prisma.district.findFirst({ where: { uuid, deletedAt: null } }),
      this.prisma.subdistrict.findFirst({ where: { uuid, deletedAt: null } }),
    ]);

    return Boolean(country || province || city || district || subdistrict);
  }
}
