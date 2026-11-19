import { getServerSession, requireAuth } from "@/lib/auth/session";
import { getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { mergeVisitorCartToUser } from "@/modules/cart/cart.service";
import { clearCartSessionCookie, getCartSessionToken } from "@/modules/cart/cookie";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = requireAuth(await getServerSession(request));
    const sessionToken = await getCartSessionToken(request);

    const mergeResult = await mergeVisitorCartToUser({
      userId: user.id,
      sessionToken,
    });

    const response = ok(mergeResult, 200, requestId);
    if (sessionToken) {
      clearCartSessionCookie(response);
    }
    return response;
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/cart/merge" });
  }
}
