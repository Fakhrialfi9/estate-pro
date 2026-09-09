export const PROPERTY_TYPES = [
  { code: 'RESIDENTIAL', name: 'Residential', slug: 'residential', description: 'Residential property.', sortOrder: 10 },
  { code: 'COMMERCIAL', name: 'Commercial', slug: 'commercial', description: 'Commercial property.', sortOrder: 20 },
  { code: 'LAND', name: 'Land', slug: 'land', description: 'Land / development parcel.', sortOrder: 30 },
] as const;

export const PROPERTY_CATEGORIES = [
  { typeCode: 'RESIDENTIAL', code: 'HOUSE', name: 'House', slug: 'house', sortOrder: 10 },
  { typeCode: 'RESIDENTIAL', code: 'APARTMENT', name: 'Apartment', slug: 'apartment', sortOrder: 20 },
  { typeCode: 'RESIDENTIAL', code: 'VILLA', name: 'Villa', slug: 'villa', sortOrder: 30 },
  { typeCode: 'COMMERCIAL', code: 'OFFICE', name: 'Office', slug: 'office', sortOrder: 10 },
  { typeCode: 'COMMERCIAL', code: 'RETAIL', name: 'Retail', slug: 'retail', sortOrder: 20 },
  { typeCode: 'LAND', code: 'DEVELOPMENT_LAND', name: 'Development Land', slug: 'development-land', sortOrder: 10 },
] as const;

export const PROPERTY_SUBCATEGORIES = [
  { categoryCode: 'HOUSE', code: 'CLUSTER_HOUSE', name: 'Cluster House', slug: 'cluster-house', sortOrder: 10 },
  { categoryCode: 'HOUSE', code: 'TOWNHOUSE', name: 'Townhouse', slug: 'townhouse', sortOrder: 20 },
  { categoryCode: 'APARTMENT', code: 'HIGH_RISE', name: 'High Rise Apartment', slug: 'high-rise', sortOrder: 10 },
  { categoryCode: 'VILLA', code: 'LUXURY_VILLA', name: 'Luxury Villa', slug: 'luxury-villa', sortOrder: 10 },
  { categoryCode: 'OFFICE', code: 'OFFICE_BUILDING', name: 'Office Building', slug: 'office-building', sortOrder: 10 },
  { categoryCode: 'RETAIL', code: 'SHOPHOUSE', name: 'Shophouse', slug: 'shophouse', sortOrder: 10 },
  { categoryCode: 'DEVELOPMENT_LAND', code: 'RESIDENTIAL_LAND', name: 'Residential Land', slug: 'residential-land', sortOrder: 10 },
] as const;

export const LOCATIONS = [
  {
    country: { code: 'ID', name: 'Indonesia', slug: 'indonesia' },
    province: { code: 'JK', name: 'DKI Jakarta', slug: 'dki-jakarta' },
    city: { code: 'JKS', name: 'Jakarta Selatan', slug: 'jakarta-selatan' },
    district: { code: 'KBY', name: 'Kebayoran Baru', slug: 'kebayoran-baru' },
    subdistrict: { code: 'SNY', name: 'Senayan', slug: 'senayan' },
  },
  {
    country: { code: 'ID', name: 'Indonesia', slug: 'indonesia' },
    province: { code: 'JB', name: 'Jawa Barat', slug: 'jawa-barat' },
    city: { code: 'BDG', name: 'Kota Bandung', slug: 'kota-bandung' },
    district: { code: 'CB', name: 'Coblong', slug: 'coblong' },
    subdistrict: { code: 'DGO', name: 'Dago', slug: 'dago' },
  },
] as const;

export const FACILITIES = [
  ['CCTV', 'CCTV', 'SECURITY'],
  ['SECURITY_GUARD', 'Security Guard', 'SECURITY'],
  ['GATED_ACCESS', 'Gated Access', 'SECURITY'],
  ['COVERED_PARKING', 'Covered Parking', 'PARKING'],
  ['GENERATOR', 'Generator', 'UTILITY'],
  ['FIBER_INTERNET', 'Fiber Internet', 'TECHNOLOGY'],
  ['SWIMMING_POOL', 'Swimming Pool', 'RECREATION'],
  ['GYM', 'Fitness Center', 'RECREATION'],
  ['PLAYGROUND', 'Children Playground', 'OUTDOOR'],
  ['ELEVATOR', 'Elevator', 'ACCESSIBILITY'],
] as const;

export const AMENITIES = [
  ['AIR_CONDITIONING', 'Air Conditioning', 'UTILITY'],
  ['BALCONY', 'Balcony', 'OUTDOOR'],
  ['BUILT_IN_KITCHEN', 'Built-in Kitchen', 'KITCHEN'],
  ['CCTV', 'CCTV', 'SECURITY'],
  ['COVERED_PARKING', 'Covered Parking', 'PARKING'],
  ['GARDEN', 'Garden', 'OUTDOOR'],
  ['SWIMMING_POOL', 'Swimming Pool', 'RECREATION'],
  ['WIFI', 'Wi-Fi', 'TECHNOLOGY'],
  ['SOLAR_POWER', 'Solar Power', 'UTILITY'],
  ['SMART_HOME', 'Smart Home', 'TECHNOLOGY'],
] as const;

const PROPERTY_SEEDS = [
  ['senayan-residence', 'HOUSE', 'CLUSTER_HOUSE', 0, 'Modern Family Residence Senayan', 'modern-family-residence-senayan', 8750000000, 4, 3, 320, 260, 2, 2, 2020, 2],
  ['dago-apartment', 'APARTMENT', 'HIGH_RISE', 1, 'Dago Skyline Apartment', 'dago-skyline-apartment', 2350000000, 2, 2, null, 78, 18, 1, 2022, 3],
  ['pondok-indah-villa', 'VILLA', 'LUXURY_VILLA', 0, 'Pondok Indah Garden Villa', 'pondok-indah-garden-villa', 11200000000, 5, 4, 420, 350, 2, 3, 2019, 4],
  ['kemang-townhouse', 'HOUSE', 'TOWNHOUSE', 0, 'Kemang Courtyard Townhouse', 'kemang-courtyard-townhouse', 5600000000, 3, 3, 180, 210, 3, 2, 2021, 5],
  ['cipete-family-home', 'HOUSE', 'CLUSTER_HOUSE', 0, 'Cipete Family Home', 'cipete-family-home', 6900000000, 4, 3, 240, 220, 2, 2, 2020, 6],
  ['kuningan-office', 'OFFICE', 'OFFICE_BUILDING', 0, 'Kuningan Business Office', 'kuningan-business-office', 9800000000, 0, 4, null, 480, 12, 8, 2018, 7],
  ['senayan-retail', 'RETAIL', 'SHOPHOUSE', 0, 'Senayan Corner Shophouse', 'senayan-corner-shophouse', 7200000000, 0, 2, 120, 240, 3, 4, 2017, 8],
  ['bandung-villa', 'VILLA', 'LUXURY_VILLA', 1, 'Dago Highland Villa', 'dago-highland-villa', 6300000000, 4, 4, 360, 280, 2, 3, 2021, 9],
  ['setiabudi-house', 'HOUSE', 'CLUSTER_HOUSE', 1, 'Setiabudi Family Residence', 'setiabudi-family-residence', 4100000000, 3, 2, 160, 145, 2, 2, 2019, 10],
  ['cidadap-house', 'HOUSE', 'TOWNHOUSE', 1, 'Cidadap Hills Townhouse', 'cidadap-hills-townhouse', 3850000000, 3, 3, 140, 175, 2, 2, 2022, 2],
  ['braga-retail', 'RETAIL', 'SHOPHOUSE', 1, 'Braga Heritage Shophouse', 'braga-heritage-shophouse', 5300000000, 0, 2, 96, 190, 3, 2, 2016, 3],
  ['buahbatu-office', 'OFFICE', 'OFFICE_BUILDING', 1, 'Buahbatu Startup Office', 'buahbatu-startup-office', 3250000000, 0, 2, null, 220, 6, 4, 2020, 4],
  ['rancaekek-land', 'DEVELOPMENT_LAND', 'RESIDENTIAL_LAND', 1, 'Rancaekek Residential Land', 'rancaekek-residential-land', 2950000000, 0, 0, 1500, null, 1, 0, 2023, 5],
  ['cileunyi-land', 'DEVELOPMENT_LAND', 'RESIDENTIAL_LAND', 1, 'Cileunyi Housing Development Land', 'cileunyi-housing-development-land', 4100000000, 0, 0, 2400, null, 1, 0, 2022, 6],
  ['antapani-apartment', 'APARTMENT', 'HIGH_RISE', 1, 'Antapani Urban Apartment', 'antapani-urban-apartment', 1850000000, 2, 1, null, 55, 15, 1, 2023, 7],
  ['pasir-kaliki-apartment', 'APARTMENT', 'HIGH_RISE', 1, 'Pasir Kaliki Residence', 'pasir-kaliki-residence', 2100000000, 2, 2, null, 68, 20, 1, 2021, 8],
  ['cempaka-house', 'HOUSE', 'CLUSTER_HOUSE', 0, 'Cempaka Putih Family House', 'cempaka-putih-family-house', 5050000000, 4, 3, 210, 190, 2, 2, 2018, 9],
  ['tebet-townhouse', 'HOUSE', 'TOWNHOUSE', 0, 'Tebet Garden Townhouse', 'tebet-garden-townhouse', 4750000000, 3, 3, 150, 180, 3, 2, 2020, 10],
  ['menteng-villa', 'VILLA', 'LUXURY_VILLA', 0, 'Menteng Heritage Villa', 'menteng-heritage-villa', 12800000000, 6, 5, 500, 420, 3, 4, 2017, 2],
  ['fatmawati-retail', 'RETAIL', 'SHOPHOUSE', 0, 'Fatmawati Trade Shophouse', 'fatmawati-trade-shophouse', 6100000000, 0, 3, 130, 260, 3, 4, 2019, 3],
] as const;

export const PROPERTY_FIXTURES = PROPERTY_SEEDS.map(([
  key,
  categoryCode,
  subcategoryCode,
  locationIndex,
  title,
  slug,
  askingPrice,
  bedrooms,
  bathrooms,
  landArea,
  buildingArea,
  floors,
  parkingSpaces,
  yearBuilt,
  agentIndex,
]) => {
  const citySlug = locationIndex === 0 ? 'senayan' : 'dago';
  const street = locationIndex === 0 ? 'Jl. Asia Afrika' : 'Jl. Ir. H. Djuanda';
  const postalCode = locationIndex === 0 ? '12190' : '40135';
  const typeCode = ['OFFICE', 'RETAIL'].includes(categoryCode)
    ? 'COMMERCIAL'
    : categoryCode === 'DEVELOPMENT_LAND'
      ? 'LAND'
      : 'RESIDENTIAL';

  return {
    key,
    businessCode: `PROP-${String(key).toUpperCase().replaceAll('-', '-')}`,
    referenceNumber: `EST-${String(key).toUpperCase()}`,
    typeCode,
    categoryCode,
    subcategoryCode,
    locationIndex,
    title,
    slug,
    shortDescription: `${title} prepared for development and testing workflows.`,
    description: `${title} is a deterministic Estate Pro fixture with realistic pricing, location, specification, sales and matching relationships.`,
    askingPrice: String(askingPrice),
    bedrooms,
    bathrooms: Number(bathrooms).toFixed(2),
    landArea: landArea === null ? null : Number(landArea).toFixed(2),
    buildingArea: buildingArea === null ? null : Number(buildingArea).toFixed(2),
    floors,
    parkingSpaces,
    yearBuilt,
    agentUserUuid: `00000000-0000-5000-8000-0000000000${String(agentIndex).padStart(2, '0')}`,
    agentDisplayName: ['Ahmad Fauzan', 'Siti Rahma', 'Rizky Pratama', 'Dewi Lestari', 'Bagas Saputra', 'Intan Permata', 'Dimas Ardian', 'Putri Ananda', 'Yoga Kurniawan', 'Maya Safitri'][agentIndex - 2] ?? 'Ahmad Fauzan',
    addressLine: `${street}, ${citySlug}`,
    street,
    neighborhood: locationIndex === 0 ? 'Senayan' : 'Dago',
    postalCode,
    latitude: locationIndex === 0 ? '-6.2251000' : '-6.8723000',
    longitude: locationIndex === 0 ? '106.8029000' : '107.6139000',
  };
});
