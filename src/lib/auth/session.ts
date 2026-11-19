import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseConfigured } from "@/lib/env";
import { ForbiddenError, UnauthorizedError } from "@/lib/http/api-response";

export const SESSION_COOKIE_NAME = "loja_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface SignedSessionPayload {
  uid: string;
  ver: string;
  iat: number;
  exp: number;
}

declare global {
  var __devAuthSecret: string | undefined;
}

function getAuthSecret(): string {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured && configured !== "gerar-segredo-aleatorio-32-bytes-hex") {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET obrigatorio e seguro em ambiente de producao.");
  }

  if (!globalThis.__devAuthSecret) {
    globalThis.__devAuthSecret = randomBytes(32).toString("hex");
  }
  return globalThis.__devAuthSecret;
}

export function computePasswordVersion(passwordHash: string | null | undefined): string {
  return createHash("sha256")
    .update(passwordHash ?? "NO_PASSWORD_HASH")
    .digest("hex")
    .slice(0, 16);
}

function signData(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSessionToken(params: {
  userId: string;
  passwordHash: string | null | undefined;
  nowSeconds?: number;
  ttlSeconds?: number;
}): string {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds ?? SESSION_TTL_SECONDS;
  const payload: SignedSessionPayload = {
    uid: params.userId,
    ver: computePasswordVersion(params.passwordHash),
    iat: now,
    exp: now + ttl,
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signData(encoded, getAuthSecret());
  return `${encoded}.${signature}`;
}

export function verifySessionToken(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignedSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) {
    return null;
  }

  const expectedSig = signData(encoded, getAuthSecret());
  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");

  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SignedSessionPayload>;

    if (
      typeof parsed.uid !== "string" ||
      typeof parsed.ver !== "string" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.iat !== "number"
    ) {
      return null;
    }

    if (parsed.exp <= nowSeconds) {
      return null;
    }

    return parsed as SignedSessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function parseCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    const key = pair.slice(0, eqIndex).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(eqIndex + 1).trim());
    }
  }
  return null;
}

export async function getServerSession(request?: Request): Promise<SessionUser | null> {
  let rawToken: string | null = null;

  if (request) {
    rawToken = parseCookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  } else {
    try {
      const cookieStore = await cookies();
      rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
    } catch {
      rawToken = null;
    }
  }

  if (!rawToken) {
    return null;
  }

  const payload = verifySessionToken(rawToken);
  if (!payload || !isDatabaseConfigured()) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.uid },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        anonymizedAt: true,
        passwordHash: true,
      },
    });

    if (!user || !user.isActive || user.anonymizedAt) {
      return null;
    }

    if (computePasswordVersion(user.passwordHash) !== payload.ver) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export function requireAuth(session: SessionUser | null | undefined): SessionUser {
  if (!session) {
    throw new UnauthorizedError("Autenticacao obrigatoria para continuar.");
  }
  return session;
}

export function requireAdmin(session: SessionUser | null | undefined): SessionUser {
  const user = requireAuth(session);
  if (user.role !== "ADMIN") {
    throw new ForbiddenError("Permissao de administrador obrigatoria.");
  }
  return user;
}

export function assertResourceOwner(
  session: SessionUser | null | undefined,
  resourceOwnerId: string,
  allowAdmin = true,
): SessionUser {
  const user = requireAuth(session);
  const isOwner = user.id === resourceOwnerId;
  const isAdminAllowed = allowAdmin && user.role === "ADMIN";

  if (!isOwner && !isAdminAllowed) {
    throw new ForbiddenError("Voce nao tem permissao para acessar este recurso.");
  }

  return user;
}

export function extractRequestAuditMeta(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  return { ipAddress, userAgent };
}
