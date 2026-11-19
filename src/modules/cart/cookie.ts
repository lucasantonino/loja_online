import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const CART_SESSION_COOKIE_NAME = "cart_session";
export const CART_TTL_DAYS = 30;
export const CART_TTL_SECONDS = CART_TTL_DAYS * 24 * 60 * 60;

function parseCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const pair of cookieHeader.split(";")) {
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

export async function getCartSessionToken(request?: Request): Promise<string | null> {
  if (request) {
    return parseCookieFromHeader(request.headers.get("cookie"), CART_SESSION_COOKIE_NAME);
  }
  try {
    const store = await cookies();
    return store.get(CART_SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

export function setCartSessionCookie(response: NextResponse, sessionToken: string): void {
  response.cookies.set(CART_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_TTL_SECONDS,
  });
}

export function clearCartSessionCookie(response: NextResponse): void {
  response.cookies.set(CART_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
