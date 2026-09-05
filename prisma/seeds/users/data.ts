import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_PHONE,
  ADMIN_USERNAME,
  DEVELOPMENT_USER_PASSWORD,
} from '../config.ts';

export type UserSeed = {
  uuid: string;
  username: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'suspended';
  password: string;
};

export const ADMIN_USER: UserSeed = {
  uuid: '00000000-0000-5000-8000-000000000001',
  email: ADMIN_EMAIL,
  username: ADMIN_USERNAME,
  phone: ADMIN_PHONE,
  password: ADMIN_PASSWORD,
  status: 'active',
};

const developmentPassword = DEVELOPMENT_USER_PASSWORD;

export const SEED_USERS: readonly UserSeed[] = [
  { uuid: '00000000-0000-5000-8000-000000000002', username: 'ahmad.fauzan', email: 'ahmad.fauzan@example.test', phone: '+6282212345678', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-000000000003', username: 'siti.rahma', email: 'siti.rahma@example.test', phone: '+6282234567890', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-000000000004', username: 'rizky.pratama', email: 'rizky.pratama@example.test', phone: '+6282311122233', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-000000000005', username: 'dewi.lestari', email: 'dewi.lestari@example.test', phone: '+6282398765432', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-000000000006', username: 'bagas.saputra', email: 'bagas.saputra@example.test', phone: '+6282112349876', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-000000000007', username: 'intan.permata', email: 'intan.permata@example.test', phone: '+6282287654321', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-000000000008', username: 'dimas.ardian', email: 'dimas.ardian@example.test', phone: '+6282176543210', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-000000000009', username: 'putri.ananda', email: 'putri.ananda@example.test', phone: '+6282299988877', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-00000000000a', username: 'yoga.kurniawan', email: 'yoga.kurniawan@example.test', phone: '+6282366655544', status: 'active', password: developmentPassword },
  { uuid: '00000000-0000-5000-8000-00000000000b', username: 'maya.safitri', email: 'maya.safitri@example.test', phone: '+6282144433322', status: 'active', password: developmentPassword },
];
