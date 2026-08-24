import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { ApplicationException } from '../../src/common/exceptions/application.exception.js';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter.js';

const createLogger = (): PinoLogger => {
  const logger = Object.create(PinoLogger.prototype) as PinoLogger;
  logger.setContext = vi.fn();
  logger.error = vi.fn();
  return logger;
};

const createConfig = (): ConfigService =>
  new ConfigService({ app: { environment: 'test' } });

describe('GlobalExceptionFilter application boundaries', () => {
  const createHost = () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      getHeader: vi.fn(),
    };
    const request = { path: '/api/v1/test', method: 'POST' };

    return {
      host: {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => request,
        }),
      } as never,
      response,
    };
  };

  const createFilter = (): GlobalExceptionFilter =>
    new GlobalExceptionFilter(createLogger(), createConfig());

  it('maps application exceptions without exposing internal details', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(
      new ApplicationException('USER_NOT_FOUND', 'User was not found.', {
        userId: 42,
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      }),
    );
    expect(response.json.mock.calls[0]?.[0]).not.toHaveProperty('details');
  });

  it('maps malformed JSON and oversized payload parser errors safely', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(
      Object.assign(new SyntaxError('unexpected token'), {
        status: 400,
        type: 'entity.parse.failed',
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_JSON',
        message: 'Request body contains invalid JSON.',
      }),
    );
  });
});
