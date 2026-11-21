
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errors: any = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const error = exceptionResponse as Record<string, any>;

        const rawMessage = error.message;

        if (Array.isArray(rawMessage)) {
          message = 'Validation failed';
          errors = rawMessage;
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }

        errorCode = error.errorCode ||
          this.getErrorCode(statusCode);

        if (error.errors !== undefined) {
          errors = error.errors;
        }
      }
    } else {
      this.logger.error(
        exception instanceof Error
          ? exception.stack
          : String(exception),
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      errorCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    });
  }

  private getErrorCode(statusCode: number): string {
    const errorCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };

    return errorCodes[statusCode] || 'HTTP_ERROR';
  }
}
