import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/lib/errors";
import { createRequestLogger } from "@/lib/logger";

export {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
};

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function getRequestId(request?: Request): string {
  const headerValue = request?.headers.get("x-request-id")?.trim();
  if (headerValue && headerValue.length <= 128) {
    return headerValue;
  }
  return `req_${randomUUID()}`;
}

export function ok<T>(data: T, status = 200, requestId?: string): NextResponse {
  const headers: HeadersInit = requestId ? { "x-request-id": requestId } : {};
  return NextResponse.json({ data }, { status, headers });
}

export function paginated<T>(
  data: T[],
  meta: PaginationMeta,
  requestId?: string,
): NextResponse {
  const headers: HeadersInit = requestId ? { "x-request-id": requestId } : {};
  return NextResponse.json({ data, meta }, { status: 200, headers });
}

export function handleApiError(
  error: unknown,
  requestId: string,
  routeContext?: Record<string, unknown>,
): NextResponse {
  const reqLogger = createRequestLogger(requestId, routeContext);

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      reqLogger.error({ err: error, code: error.code }, error.message);
    } else {
      reqLogger.warn({ code: error.code, statusCode: error.statusCode }, error.message);
    }

    const headers: Record<string, string> = { "x-request-id": requestId };
    if (error instanceof TooManyRequestsError) {
      headers["Retry-After"] = String(error.retryAfterSeconds);
    }

    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
          requestId,
        },
      },
      { status: error.statusCode, headers },
    );
  }

  if (error instanceof ZodError) {
    reqLogger.warn({ code: "VALIDATION_ERROR", issues: error.issues }, "Erro de validacao Zod");
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados de entrada invalidos.",
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
          requestId,
        },
      },
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    reqLogger.warn({ prismaCode: error.code, meta: error.meta }, "Violacao de unicidade");
    return NextResponse.json(
      {
        error: {
          code: "UNIQUE_CONSTRAINT_VIOLATION",
          message: "Ja existe um registro com o identificador unico informado.",
          requestId,
        },
      },
      { status: 409, headers: { "x-request-id": requestId } },
    );
  }

  reqLogger.error({ err: error }, "Erro interno inesperado na API");

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ocorreu um erro interno inesperado.",
        requestId,
      },
    },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}
