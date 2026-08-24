import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter.js';

const createLogger = (): PinoLogger => {
  const logger = Object.create(PinoLogger.prototype) as PinoLogger;
  logger.setContext = vi.fn();
  logger.error = vi.fn();
  return logger;
};

const createConfig = (): ConfigService =>
  new ConfigService({ app: { environment: 'test' } });

const createFilter = (): GlobalExceptionFilter =>
  new GlobalExceptionFilter(createLogger(), createConfig());

const createHost = (requestUrl = '/api/v1/test') => {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    getHeader: vi.fn(),
  };
  const request = { path: requestUrl, method: 'GET' };

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

describe('GlobalExceptionFilter', () => {
  it('normalizes HttpException responses', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(new BadRequestException('Invalid request.'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'BAD_REQUEST',
        message: 'Invalid request.',
        path: '/api/v1/test',
      }),
    );
  });

  it('does not expose unknown exception details', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(new Error('database password=secret'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.',
      }),
    );
    expect(response.json.mock.calls[0]?.[0]).not.toEqual(
      expect.objectContaining({ message: 'database password=secret' }),
    );
  });

  it('maps Prisma known request errors without exposing database details', () => {
    class PrismaClientKnownRequestError extends Error {
      code = 'P2002';
    }

    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(
      new PrismaClientKnownRequestError('duplicate database value'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        code: 'DATABASE_P2002',
        message: 'Resource already exists.',
      }),
    );
  });

  it('preserves safe structured application error codes', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(
      new HttpException(
        { code: 'VALIDATION_ERROR', message: ['name must be a string'] },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: ['name must be a string'],
      }),
    );
  });
});
