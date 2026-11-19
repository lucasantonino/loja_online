import { setSessionCookie } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { enforceRateLimit, extractClientIp } from "@/lib/rate-limit";
import { authenticateUser } from "@/modules/auth/auth.service";
import { loginSchema } from "@/modules/auth/schemas";
import { mergeVisitorCartToUser } from "@/modules/cart/cart.service";
import { clearCartSessionCookie, getCartSessionToken } from "@/modules/cart/cookie";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = loginSchema.parse(rawBody);
    const clientIp = extractClientIp(request);

    await enforceRateLimit({
      bucket: "login",
      identifier: `${clientIp}:${input.email}`,
    });

    const result = await authenticateUser(input);
    const visitorCartToken = await getCartSessionToken(request);
    const mergeResult = await mergeVisitorCartToUser({
      userId: result.user.id,
      sessionToken: visitorCartToken,
    });

    const response = ok(
      {
        user: result.user,
        cartMergeWarnings: mergeResult.warnings,
      },
      200,
      requestId,
    );
    setSessionCookie(response, result.sessionToken);
    if (visitorCartToken) {
      clearCartSessionCookie(response);
    }
    return response;
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/auth/login" });
  }
}
