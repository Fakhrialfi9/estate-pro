import { registerAs } from '@nestjs/config';

export interface ApplicationMetadata {
  name: string;
  version: string;
  environment: string;
}

export const getApplicationMetadata = (): ApplicationMetadata => ({
  name: process.env.APP_NAME ?? 'estate-pro-api',
  version:
    process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.0.1',
  environment: process.env.NODE_ENV ?? 'development',
});

export default registerAs('app', () => {
  const metadata = getApplicationMetadata();

  return {
    ...metadata,
    host: process.env.APP_HOST ?? '0.0.0.0',
    port: Number(process.env.APP_PORT ?? 3000),
    publicBaseUrl:
      process.env.APP_PUBLIC_URL?.trim() ||
      (process.env.NODE_ENV === 'production'
        ? undefined
        : `http://localhost:${process.env.APP_PORT ?? 3000}`),
  };
});
