import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'estate-pro-api',
  version:
    process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.0.1',
  environment: process.env.NODE_ENV ?? 'development',
  host: process.env.APP_HOST ?? '0.0.0.0',
  port: Number(process.env.APP_PORT ?? 3000),
}));
