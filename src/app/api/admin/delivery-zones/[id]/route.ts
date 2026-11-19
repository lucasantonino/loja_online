import { extractRequestAuditMeta, getServerSession, requireAdmin } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { updateDeliveryZoneSchema } from "@/modules/delivery/zone.schemas";
import { deleteDeliveryZone, updateDeliveryZone } from "@/modules/delivery/zone.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const admin = requireAdmin(await getServerSession(request));
    const { id } = await context.params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = updateDeliveryZoneSchema.parse(rawBody);
    const updated = await updateDeliveryZone(id, input, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    return ok(updated, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/delivery-zones/[id]" });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const admin = requireAdmin(await getServerSession(request));
    const { id } = await context.params;

    const result = await deleteDeliveryZone(id, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    return ok(result, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/delivery-zones/[id]" });
  }
}
