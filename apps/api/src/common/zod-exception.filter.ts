import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';

/**
 * Zod `.parse()` throws ZodError outside Nest's ValidationPipe path.
 * Without this filter those become opaque 500s (audit H4).
 *
 * Extends BaseExceptionFilter so non-Zod errors keep Nest's default handling.
 */
@Catch()
export class ZodExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly zodLogger = new Logger(ZodExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (!isZodError(exception)) {
      super.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const issues = exception.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    this.zodLogger.warn(`Zod validation failed: ${JSON.stringify(issues)}`);

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      errors: issues,
      error: 'Bad Request',
    });
  }
}

function isZodError(
  err: unknown,
): err is { name: string; issues: Array<{ path: Array<string | number>; message: string }> } {
  return (
    !!err &&
    typeof err === 'object' &&
    (err as { name?: string }).name === 'ZodError' &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}
