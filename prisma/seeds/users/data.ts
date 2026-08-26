import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE, ADMIN_USERNAME } from '../config.ts';

export const ADMIN_USER = {
  email: ADMIN_EMAIL,
  username: ADMIN_USERNAME,
  phone: ADMIN_PHONE,
  password: ADMIN_PASSWORD,
  status: 'active',
} as const;
