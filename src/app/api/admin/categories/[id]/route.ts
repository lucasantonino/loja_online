import { extractRequestAuditMeta, getServerSession, requireAdmin } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import {
  deleteCategory,
  revalidateCatalogCache,
  updateCategory,
} from "@/modules/catalog/catalog.service";
import { updateCategorySchema } from "@/modules/catalog/schemas";

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

    const input = updateCategorySchema.parse(rawBody);
    const category = await updateCategory(id, input, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    revalidateCatalogCache();
    return ok(category, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/categories/[id]" });
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

    const result = await deleteCategory(id, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    revalidateCatalogCache();
    return ok(result, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/categories/[id]" });
  }
}
