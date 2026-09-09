const AGENT_SPECS = [
  ['00000000-0000-5000-8000-000000000002', 'Ahmad Fauzan', 'Residential property advisor focused on Jakarta.', 'ACTIVE', 12, '2025-01-06', ['RESIDENTIAL', 'LUXURY'], 'JKS', 'Jakarta Selatan'],
  ['00000000-0000-5000-8000-000000000003', 'Siti Rahma', 'Residential and apartment sales advisor focused on Bandung.', 'ACTIVE', 10, '2025-02-03', ['RESIDENTIAL', 'LEASING'], 'BDG', 'Kota Bandung'],
  ['00000000-0000-5000-8000-000000000004', 'Rizky Pratama', 'Commercial advisor specializing in offices and retail assets.', 'ACTIVE', 14, '2024-11-18', ['COMMERCIAL', 'LEASING'], 'JKS', 'Jakarta Selatan'],
  ['00000000-0000-5000-8000-000000000005', 'Dewi Lestari', 'Luxury home advisor serving premium residential buyers.', 'ACTIVE', 8, '2024-09-09', ['LUXURY', 'RESIDENTIAL'], 'JKS', 'Jakarta Selatan'],
  ['00000000-0000-5000-8000-000000000006', 'Bagas Saputra', 'Land and development advisor for growing suburban markets.', 'ACTIVE', 12, '2025-03-17', ['LAND', 'COMMERCIAL'], 'BDG', 'Kota Bandung'],
  ['00000000-0000-5000-8000-000000000007', 'Intan Permata', 'Apartment leasing advisor focused on corporate tenants.', 'ACTIVE', 15, '2024-08-12', ['LEASING', 'COMMERCIAL'], 'JKS', 'Jakarta Selatan'],
  ['00000000-0000-5000-8000-000000000008', 'Dimas Ardian', 'Family home advisor with a focus on first-time buyers.', 'ACTIVE', 10, '2025-04-21', ['RESIDENTIAL'], 'BDG', 'Kota Bandung'],
  ['00000000-0000-5000-8000-000000000009', 'Putri Ananda', 'Investment property advisor covering mixed-use opportunities.', 'ACTIVE', 9, '2024-10-28', ['COMMERCIAL', 'LUXURY'], 'JKS', 'Jakarta Selatan'],
  ['00000000-0000-5000-8000-00000000000a', 'Yoga Kurniawan', 'Residential advisor specializing in townhouses and clusters.', 'ON_LEAVE', 8, '2025-01-27', ['RESIDENTIAL'], 'BDG', 'Kota Bandung'],
  ['00000000-0000-5000-8000-00000000000b', 'Maya Safitri', 'Property leasing and land advisor for local investors.', 'INACTIVE', 6, '2024-06-10', ['LEASING', 'LAND'], 'JKS', 'Jakarta Selatan'],
] as const;

export const AGENT_FIXTURES = AGENT_SPECS.map(([
  userUuid,
  displayName,
  bio,
  status,
  maxActiveAssignments,
  hireDate,
  specializationCodes,
  cityCode,
  cityLabel,
]) => ({
  userUuid,
  displayName,
  bio,
  status,
  timeZone: 'Asia/Jakarta',
  maxActiveAssignments,
  hireDate,
  specializationCodes,
  coverage: {
    level: 'CITY',
    regionUuid: `00000000-0000-5000-8000-0000000010${cityCode === 'JKS' ? '01' : '02'}`,
    label: cityLabel,
  },
}));
