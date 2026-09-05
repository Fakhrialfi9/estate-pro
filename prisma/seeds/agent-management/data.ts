export const AGENT_FIXTURES = [
  {
    userUuid: '00000000-0000-5000-8000-000000000002',
    displayName: 'Ahmad Fauzan',
    bio: 'Residential property advisor focused on Jakarta.',
    status: 'ACTIVE',
    timeZone: 'Asia/Jakarta',
    maxActiveAssignments: 12,
    hireDate: '2025-01-06',
    specializationCodes: ['RESIDENTIAL', 'LUXURY'],
    coverage: { level: 'CITY', regionUuid: '00000000-0000-5000-8000-000000001001', label: 'Jakarta Selatan' },
  },
  {
    userUuid: '00000000-0000-5000-8000-000000000003',
    displayName: 'Siti Rahma',
    bio: 'Residential and apartment sales advisor focused on Bandung.',
    status: 'ACTIVE',
    timeZone: 'Asia/Jakarta',
    maxActiveAssignments: 10,
    hireDate: '2025-02-03',
    specializationCodes: ['RESIDENTIAL', 'LEASING'],
    coverage: { level: 'CITY', regionUuid: '00000000-0000-5000-8000-000000001002', label: 'Kota Bandung' },
  },
] as const;
