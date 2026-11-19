import { extractRequestAuditMeta, getServerSession, requireAdmin } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import {
  archiveOrDeleteProduct,
  getAdminProductById,
  revalidateCatalogCache,
  updateProduct,
} from "@/modules/catalog/catalog.service";
import { updateProductSchema } from "@/modules/catalog/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);

  try {
    requireAdmin(await getServerSession(request));
    const { id } = await context.params;
    const product = await getAdminProductById(id);
    return ok(product, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/products/[id]" });
  }
}

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

    const input = updateProductSchema.parse(rawBody);
    const updated = await updateProduct(id, input, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    revalidateCatalogCache(updated.slug);
    return ok(updated, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/products/[id]" });
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

    const result = await archiveOrDeleteProduct(id, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    revalidateCatalogCache();
    return ok(result, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/products/[id]" });
  }
}
