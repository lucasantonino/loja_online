import { getServerSession } from "@/lib/auth/session";
import { getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { getCart } from "@/modules/cart/cart.service";
import { getCartSessionToken } from "@/modules/cart/cookie";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const [session, sessionToken] = await Promise.all([
      getServerSession(request),
      getCartSessionToken(request),
    ]);

    const cart = await getCart({
      userId: session?.id ?? null,
      sessionToken,
    });

    return ok(cart, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/cart" });
  }
}
