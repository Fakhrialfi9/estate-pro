import { randomUUID } from 'node:crypto';
import type { SeedTransaction } from './database.ts';

const AMENITIES = [
  { code: 'AIR_CONDITIONING', name: 'Air Conditioning', category: 'UTILITY', sortOrder: 10 },
  { code: 'BALCONY', name: 'Balcony', category: 'OUTDOOR', sortOrder: 20 },
  { code: 'BUILT_IN_KITCHEN', name: 'Built-in Kitchen', category: 'KITCHEN', sortOrder: 30 },
  { code: 'CCTV', name: 'CCTV', category: 'SECURITY', sortOrder: 40 },
  { code: 'COVERED_PARKING', name: 'Covered Parking', category: 'PARKING', sortOrder: 50 },
  { code: 'GARDEN', name: 'Garden', category: 'OUTDOOR', sortOrder: 60 },
  { code: 'SWIMMING_POOL', name: 'Swimming Pool', category: 'RECREATION', sortOrder: 70 },
  { code: 'WIFI', name: 'Wi-Fi', category: 'TECHNOLOGY', sortOrder: 80 },
] as const;

export async function seedPropertyCapabilities(tx: SeedTransaction): Promise<void> {
  for (const amenity of AMENITIES) {
    await tx.propertyAmenity.upsert({
      where: { code: amenity.code },
      update: {
        name: amenity.name,
        category: amenity.category,
        sortOrder: amenity.sortOrder,
        isActive: true,
      },
      create: {
        uuid: randomUUID(),
        code: amenity.code,
        name: amenity.name,
        category: amenity.category,
        sortOrder: amenity.sortOrder,
        isActive: true,
      },
    });
  }
}
