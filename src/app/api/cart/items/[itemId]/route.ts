import { getServerSession } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { removeCartItem, updateCartItemQuantity } from "@/modules/cart/cart.service";
import { getCartSessionToken } from "@/modules/cart/cookie";
import { updateCartItemSchema } from "@/modules/cart/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const [{ itemId }, session, sessionToken] = await Promise.all([
      context.params,
      getServerSession(request),
      getCartSessionToken(request),
    ]);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = updateCartItemSchema.parse(rawBody);
    const cart = await updateCartItemQuantity({
      actor: {
        userId: session?.id ?? null,
        sessionToken,
      },
      itemId,
      quantity: input.quantity,
    });

    return ok(cart, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/cart/items/[itemId]" });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const [{ itemId }, session, sessionToken] = await Promise.all([
      context.params,
      getServerSession(request),
      getCartSessionToken(request),
    ]);

    const cart = await removeCartItem({
      actor: {
        userId: session?.id ?? null,
        sessionToken,
      },
      itemId,
    });

    return ok(cart, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/cart/items/[itemId]" });
  }
}
