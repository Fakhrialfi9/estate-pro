import { registerAs } from '@nestjs/config';

export default registerAs('api', () => ({
  prefix: process.env.API_PREFIX ?? 'api',
  version: process.env.API_VERSION ?? 'v1',
}));
