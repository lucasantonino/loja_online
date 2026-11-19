import { extractRequestAuditMeta, getServerSession, requireAdmin } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { revalidateCatalogCache } from "@/modules/catalog/catalog.service";
import { adjustVariantStock } from "@/modules/inventory/inventory.service";
import { manualStockAdjustmentSchema } from "@/modules/inventory/schemas";

export const dynamic = "force-dynamic";

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

    const input = manualStockAdjustmentSchema.parse(rawBody);
    const result = await adjustVariantStock(input, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    revalidateCatalogCache();
    return ok(result, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/inventory/adjust" });
  }
}
