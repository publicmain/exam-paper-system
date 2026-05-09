import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global error filter.
 *
 * Why we need this on top of Nest's default:
 *   - Nest's default surfaces a Prisma error like "Unique constraint failed
 *     on the fields: (`email`)" verbatim. In prod that leaks schema details
 *     and column names; in dev we want it.
 *   - Unmodelled errors from the Anthropic SDK / fetch / pdf-lib used to
 *     bubble up as 500 + the raw stack trace as the response body.
 *
 * Behaviour:
 *   - HttpException (the Nest-native shape) is passed through untouched.
 *   - Anything else: log at error level WITH stack, return a generic 500
 *     in prod, return the message + stack in dev. Status is sourced from
 *     the exception's `getStatus()` if present, else 500.
 *
 * Round-7 agent-9 A1.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // 5xx still gets logged so we see them in Railway logs even when
      // pre-modelled (e.g. ServiceUnavailableException from Anthropic).
      if (status >= 500) {
        this.logger.error(
          `${req.method} ${req.originalUrl ?? req.url} → ${status} (HttpException) ${exception.message}`,
        );
      }
      return res.status(status).json(typeof body === 'string' ? { message: body } : body);
    }

    // Anything else — Prisma, fetch, JSON.parse, etc.
    const isProd = process.env.NODE_ENV === 'production';
    const err = exception as any;
    const status =
      typeof err?.status === 'number' ? err.status : HttpStatus.INTERNAL_SERVER_ERROR;
    this.logger.error(
      `${req.method} ${req.originalUrl ?? req.url} → ${status} (unhandled) ${err?.message ?? err}`,
      err?.stack,
    );
    res.status(status).json({
      statusCode: status,
      message: isProd ? 'Internal server error' : String(err?.message ?? err),
      // expose code (Prisma's "P2002" etc.) in dev only — useful for the
      // dev console, not for prod clients.
      ...(isProd
        ? {}
        : {
            error: err?.name ?? 'Error',
            code: err?.code,
            stack: typeof err?.stack === 'string' ? err.stack.split('\n').slice(0, 8) : undefined,
          }),
    });
  }
}
