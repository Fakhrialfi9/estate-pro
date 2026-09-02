import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type { PropertyRegionPort } from '../../common/contracts/property-region.port.js';

@Injectable()
export class PrismaPropertyRegionAdapter implements PropertyRegionPort {
  constructor(private readonly prisma: PrismaService) {}
  async isKnownRegion(uuid: string): Promise<boolean> {
    const db = this.prisma as any;
    const [country, province, city, district, subdistrict] = await Promise.all([
      db.country.findFirst({ where: { uuid, deletedAt: null } }),
      db.province.findFirst({ where: { uuid, deletedAt: null } }),
      db.city.findFirst({ where: { uuid, deletedAt: null } }),
      db.district.findFirst({ where: { uuid, deletedAt: null } }),
      db.subdistrict.findFirst({ where: { uuid, deletedAt: null } }),
    ]);
    return Boolean(country || province || city || district || subdistrict);
  }
}
