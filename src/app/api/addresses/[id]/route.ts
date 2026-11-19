import { getServerSession, requireAuth } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { updateAddressSchema } from "@/modules/delivery/address.schemas";
import { deleteUserAddress, updateUserAddress } from "@/modules/delivery/address.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const user = requireAuth(await getServerSession(request));
    const { id } = await context.params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = updateAddressSchema.parse(rawBody);
    const updated = await updateUserAddress(user.id, id, input);
    return ok(updated, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/addresses/[id]" });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const user = requireAuth(await getServerSession(request));
    const { id } = await context.params;
    const result = await deleteUserAddress(user.id, id);
    return ok(result, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/addresses/[id]" });
  }
}
