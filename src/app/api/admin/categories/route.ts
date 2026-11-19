import { extractRequestAuditMeta, getServerSession, requireAdmin } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import {
  createCategory,
  listAdminCategories,
  revalidateCatalogCache,
} from "@/modules/catalog/catalog.service";
import { createCategorySchema } from "@/modules/catalog/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    requireAdmin(await getServerSession(request));
    const categories = await listAdminCategories();
    return ok(categories, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/categories" });
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

    const input = createCategorySchema.parse(rawBody);
    const meta = extractRequestAuditMeta(request);
    const category = await createCategory(input, {
      actorUserId: admin.id,
      ...meta,
    });

    revalidateCatalogCache();
    return ok(category, 201, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/categories" });
  }
}
