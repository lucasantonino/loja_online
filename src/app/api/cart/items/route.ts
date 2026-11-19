import { getServerSession } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { addItemToCart } from "@/modules/cart/cart.service";
import { getCartSessionToken, setCartSessionCookie } from "@/modules/cart/cookie";
import { addCartItemSchema } from "@/modules/cart/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const [session, sessionToken] = await Promise.all([
      getServerSession(request),
      getCartSessionToken(request),
    ]);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = addCartItemSchema.parse(rawBody);
    const result = await addItemToCart({
      actor: {
        userId: session?.id ?? null,
        sessionToken,
      },
      variantId: input.variantId,
      quantity: input.quantity,
    });

    const response = ok(result.cart, 200, requestId);
    if (result.newVisitorSessionToken) {
      setCartSessionCookie(response, result.newVisitorSessionToken);
    }
    return response;
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/cart/items" });
  }
}
