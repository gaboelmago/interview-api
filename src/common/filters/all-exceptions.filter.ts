import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

type ErrorResponseBody = {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<any>();
    const req = ctx.getRequest<any>();

    const path = (req?.originalUrl ?? req?.url ?? "") as string;
    const timestamp = new Date().toISOString();

    // Defaults: safe 500
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = "Internal Server Error";
    let message: string | string[] = "Internal server error";

    // Standard Nest HttpExceptions (404, 400, etc)
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const response = exception.getResponse();
      if (typeof response === "string") {
        message = response;
      } else if (isRecord(response)) {
        const respMessage = response.message;
        const respError = response.error;

        if (typeof respMessage === "string" || Array.isArray(respMessage)) {
          message = respMessage;
        } else {
          message = exception.message;
        }

        if (typeof respError === "string") {
          error = respError;
        } else {
          error = "Error";
        }
      } else {
        message = exception.message;
        error = "Error";
      }
    }
    // Minimal Prisma -> HTTP mapping (kept intentionally small)
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2025": {
          statusCode = HttpStatus.NOT_FOUND;
          error = "Not Found";
          message = "Resource not found";
          break;
        }
        case "P2002": {
          statusCode = HttpStatus.CONFLICT;
          error = "Conflict";
          message = "Unique constraint violation";
          break;
        }
        case "P2003": {
          statusCode = HttpStatus.BAD_REQUEST;
          error = "Bad Request";
          message = "Foreign key constraint violation";
          break;
        }
        default: {
          statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          error = "Internal Server Error";
          message = "Internal server error";
          break;
        }
      }

      this.logger.error(
        { path, statusCode, prismaCode: exception.code },
        exception instanceof Error ? exception.stack : String(exception)
      );
    } else {
      // Unknown/unhandled errors
      this.logger.error(
        { path, statusCode },
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      error,
      message,
      path,
      timestamp,
    };

    res.status(statusCode).json(body);
  }
}
