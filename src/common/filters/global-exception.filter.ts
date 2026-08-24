import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ApplicationException } from '../exceptions/application.exception.js';
import { DomainException } from '../exceptions/domain.exception.js';
import { InfrastructureException } from '../exceptions/infrastructure.exception.js';

interface ErrorBody {
  code?: unknown;
  message?: unknown;
}

interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

interface PrismaLikeError {
  code: string;
}

interface ExpressPayloadError {
  status: number;
  type?: string;
}

const isErrorBody = (body: object): body is ErrorBody => {
  const candidate: Record<string, unknown> = Object.fromEntries(
    Object.entries(body),
  );

  return (
    (!('code' in candidate) || typeof candidate.code === 'string') &&
    (!('message' in candidate) ||
      typeof candidate.message === 'string' ||
      Array.isArray(candidate.message))
  );
};

const isPrismaLikeError = (exception: unknown): exception is PrismaLikeError => {
  if (!(exception instanceof Error)) {
    return false;
  }

  return (
    exception.constructor.name === 'PrismaClientKnownRequestError' &&
    'code' in exception &&
    typeof exception.code === 'string'
  );
};

const isExpressPayloadError = (
  exception: unknown,
): exception is ExpressPayloadError => {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }

  const candidate = Object.fromEntries(Object.entries(exception));
  return (
    typeof candidate.status === 'number' &&
    (candidate.type === 'entity.parse.failed' ||
      candidate.type === 'entity.too.large')
  );
};

const getPrismaStatus = (code: string): number => {
  switch (code) {
    case 'P2002':
      return HttpStatus.CONFLICT;
    case 'P2003':
    case 'P2014':
      return HttpStatus.BAD_REQUEST;
    case 'P2025':
      return HttpStatus.NOT_FOUND;
    case 'P2024':
      return HttpStatus.SERVICE_UNAVAILABLE;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
};

const getPrismaMessage = (code: string): string => {
  switch (code) {
    case 'P2002':
      return 'Resource already exists.';
    case 'P2003':
    case 'P2014':
      return 'The requested database operation is invalid.';
    case 'P2025':
      return 'The requested resource was not found.';
    case 'P2024':
      return 'The database is temporarily unavailable.';
    default:
      return 'An internal database error occurred.';
  }
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const result = this.buildResponse(exception, request);

    if (result.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled ${exception instanceof Error ? exception.constructor.name : 'exception'}`,
      );
    }

    response.status(result.statusCode).json(result);
  }

  private buildResponse(exception: unknown, request: Request): ApiErrorResponse {
    const timestamp = new Date().toISOString();

    if (exception instanceof DomainException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        path: request.originalUrl,
        timestamp,
      };
    }

    if (exception instanceof ApplicationException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        path: request.originalUrl,
        timestamp,
      };
    }

    if (exception instanceof InfrastructureException) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: exception.code,
        message: 'A required infrastructure service is unavailable.',
        path: request.originalUrl,
        timestamp,
      };
    }

    if (isPrismaLikeError(exception)) {
      const statusCode = getPrismaStatus(exception.code);

      return {
        statusCode,
        code: `DATABASE_${exception.code}`,
        message: getPrismaMessage(exception.code),
        path: request.originalUrl,
        timestamp,
      };
    }

    if (isExpressPayloadError(exception)) {
      const statusCode =
        exception.type === 'entity.too.large'
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST;

      return {
        statusCode,
        code:
          exception.type === 'entity.too.large'
            ? 'PAYLOAD_TOO_LARGE'
            : 'INVALID_JSON',
        message:
          exception.type === 'entity.too.large'
            ? 'Request payload is too large.'
            : 'Request body contains invalid JSON.',
        path: request.originalUrl,
        timestamp,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const normalized = this.normalizeHttpExceptionBody(
        exception.getResponse(),
        statusCode,
      );

      return {
        statusCode,
        code: normalized.code,
        message: normalized.message,
        path: request.originalUrl,
        timestamp,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error.',
      path: request.originalUrl,
      timestamp,
    };
  }

  private normalizeHttpExceptionBody(
    body: string | object,
    statusCode: number,
  ): { code: string; message: string | string[] } {
    if (typeof body === 'string') {
      return { code: this.defaultHttpCode(statusCode), message: body };
    }

    if (!isErrorBody(body)) {
      return {
        code: this.defaultHttpCode(statusCode),
        message: statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error.'
          : 'Request failed.',
      };
    }

    return {
      code:
        typeof body.code === 'string'
          ? body.code
          : this.defaultHttpCode(statusCode),
      message: this.normalizeMessage(body.message, statusCode),
    };
  }

  private normalizeMessage(
    message: unknown,
    statusCode: number,
  ): string | string[] {
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message;
    }

    if (typeof message === 'string') {
      return message;
    }

    return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal server error.'
      : 'Request failed.';
  }

  private defaultHttpCode(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'PAYLOAD_TOO_LARGE';
      default:
        return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'INTERNAL_SERVER_ERROR'
          : `HTTP_${statusCode}`;
    }
  }
}
