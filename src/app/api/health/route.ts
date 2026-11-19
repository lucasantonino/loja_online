import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseConfigured } from "@/lib/env";
import { getRequestId } from "@/lib/http/api-response";
import { createRequestLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const log = createRequestLogger(requestId, { route: "/api/health" });
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_NOT_CONFIGURED",
          message: "Variavel DATABASE_URL nao configurada neste ambiente.",
          requestId,
        },
      },
      { status: 503, headers: { "x-request-id": requestId } },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        data: {
          status: "ok",
          database: "connected",
          version,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    log.error({ err: error }, "Healthcheck falhou ao consultar PostgreSQL");
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Banco de dados indisponivel no momento.",
          requestId,
        },
      },
      { status: 503, headers: { "x-request-id": requestId } },
    );
  }
}
