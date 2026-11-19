import { getServerSession, requireAuth } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { createAddressSchema } from "@/modules/delivery/address.schemas";
import { createUserAddress, listUserAddresses } from "@/modules/delivery/address.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = requireAuth(await getServerSession(request));
    const addresses = await listUserAddresses(user.id);
    return ok(addresses, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/addresses" });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = requireAuth(await getServerSession(request));

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = createAddressSchema.parse(rawBody);
    const created = await createUserAddress(user.id, input);
    return ok(created, 201, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/addresses" });
  }
}
