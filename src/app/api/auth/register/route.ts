import { setSessionCookie } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { enforceRateLimit, extractClientIp } from "@/lib/rate-limit";
import { registerCustomer } from "@/modules/auth/auth.service";
import { registerSchema } from "@/modules/auth/schemas";
import { mergeVisitorCartToUser } from "@/modules/cart/cart.service";
import { clearCartSessionCookie, getCartSessionToken } from "@/modules/cart/cookie";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    await enforceRateLimit({
      bucket: "register",
      identifier: extractClientIp(request),
    });

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = registerSchema.parse(rawBody);
    const result = await registerCustomer(input);
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
      201,
      requestId,
    );
    setSessionCookie(response, result.sessionToken);
    if (visitorCartToken) {
      clearCartSessionCookie(response);
    }
    return response;
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/auth/register" });
  }
}
