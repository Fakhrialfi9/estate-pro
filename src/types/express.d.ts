import type { Request } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      sub?: string;
      [key: string]: unknown;
    };
  }
}

declare module '../modules/crm/presentation/crm.dto.js' {
  interface PageDto {
    [key: string]: unknown;
  }
}

export type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    [key: string]: unknown;
  };
};
