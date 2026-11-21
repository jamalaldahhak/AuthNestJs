
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';

import {
  RESPONSE_MESSAGE_KEY,
} from '../decorators/response-message.decorator.js';

import { ApiResponse } from '../interfaces/api-response.interface.js';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const customMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    return next.handle().pipe(
      map((result) => {
        // Support optional custom data/message format
        const isCustomResponse =
          result !== null &&
          typeof result === 'object' &&
          !Array.isArray(result) &&
          'data' in result &&
          'message' in result;

        const data = isCustomResponse
          ? result.data
          : result;

        const message = customMessage ||
          (isCustomResponse
            ? result.message
            : 'Request successful');

        const apiResponse: ApiResponse<T> = {
          success: true,
          statusCode: response.statusCode,
          message,
          data,
          timestamp: new Date().toISOString(),
          path: request.originalUrl || request.url,
        };

        return apiResponse;
      }),
    );
  }
}
