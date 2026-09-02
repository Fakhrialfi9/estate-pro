import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';

export class AnalyticsInvalidQueryException extends BadRequestException {
  constructor(message = 'Analytics query is invalid.') {
    super({ code: 'ANALYTICS_INVALID_QUERY', message });
  }
}

export class AnalyticsScopeException extends ForbiddenException {
  constructor(
    message = 'You are not authorized to access this analytics scope.',
  ) {
    super({ code: 'ANALYTICS_FORBIDDEN_SCOPE', message });
  }
}

export class AnalyticsQueryTimeoutException extends GatewayTimeoutException {
  constructor() {
    super({
      code: 'ANALYTICS_QUERY_TIMEOUT',
      message: 'Analytics query timed out.',
    });
  }
}

export class AnalyticsUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      code: 'ANALYTICS_UNAVAILABLE',
      message: 'Analytics data is temporarily unavailable.',
    });
  }
}
