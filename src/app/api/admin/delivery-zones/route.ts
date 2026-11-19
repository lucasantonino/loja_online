import { extractRequestAuditMeta, getServerSession, requireAdmin } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { createDeliveryZoneSchema } from "@/modules/delivery/zone.schemas";
import { createDeliveryZone, listAdminDeliveryZones } from "@/modules/delivery/zone.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    requireAdmin(await getServerSession(request));
    const zones = await listAdminDeliveryZones();
    return ok(zones, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/delivery-zones" });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const admin = requireAdmin(await getServerSession(request));

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = createDeliveryZoneSchema.parse(rawBody);
    const created = await createDeliveryZone(input, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    return ok(created, 201, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/delivery-zones" });
  }
}
