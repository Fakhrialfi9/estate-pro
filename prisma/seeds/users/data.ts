import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE, ADMIN_USERNAME } from '../config.ts';

export type UserSeed = {
  username: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'suspended';
  password: string;
};

export const ADMIN_USER: UserSeed = {
  email: ADMIN_EMAIL,
  username: ADMIN_USERNAME,
  phone: ADMIN_PHONE,
  password: ADMIN_PASSWORD,
  status: 'active',
};

export const SEED_USERS: readonly UserSeed[] = [
  {
    username: 'ahmad.fauzan',
    email: 'ahmad.fauzan@example.com',
    phone: '+6282212345678',
    status: 'active',
    password: 'R7#kL2@pQ9!x',
  },
  {
    username: 'siti.rahma',
    email: 'siti.rahma@example.com',
    phone: '+6282234567890',
    status: 'active',
    password: 'T4@mN8#vC6$z',
  },
  {
    username: 'rizky.pratama',
    email: 'rizky.pratama@example.com',
    phone: '+6282311122233',
    status: 'active',
    password: 'K9$pW3@fH7!q',
  },
  {
    username: 'dewi.lestari',
    email: 'dewi.lestari@example.com',
    phone: '+6282398765432',
    status: 'active',
    password: 'M5#rT8@xL2!v',
  },
  {
    username: 'bagas.saputra',
    email: 'bagas.saputra@example.com',
    phone: '+6282112349876',
    status: 'active',
    password: 'J8@qS4#nY6$p',
  },
  {
    username: 'intan.permata',
    email: 'intan.permata@example.com',
    phone: '+6282287654321',
    status: 'active',
    password: 'V3!mK7@dR9#t',
  },
  {
    username: 'dimas.ardian',
    email: 'dimas.ardian@example.com',
    phone: '+6282176543210',
    status: 'active',
    password: 'Q6#zF2@wN8!k',
  },
  {
    username: 'putri.ananda',
    email: 'putri.ananda@example.com',
    phone: '+6282299988877',
    status: 'active',
    password: 'H4@cP9#sT7!m',
  },
  {
    username: 'yoga.kurniawan',
    email: 'yoga.kurniawan@example.com',
    phone: '+6282366655544',
    status: 'active',
    password: 'N7!xB3@qL5#r',
  },
  {
    username: 'maya.safitri',
    email: 'maya.safitri@example.com',
    phone: '+6282144433322',
    status: 'active',
    password: 'C8#vR4@mJ6!p',
  },
];
