import type { ProductStatus } from "@prisma/client";
import { extractRequestAuditMeta, getServerSession, requireAdmin } from "@/lib/auth/session";
import {
  BadRequestError,
  getRequestId,
  handleApiError,
  ok,
  paginated,
} from "@/lib/http/api-response";
import {
  createProduct,
  listAdminProducts,
  revalidateCatalogCache,
} from "@/modules/catalog/catalog.service";
import { createProductSchema, productStatusSchema } from "@/modules/variants/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    requireAdmin(await getServerSession(request));

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const rawStatus = searchParams.get("status");
    const status: ProductStatus | undefined = rawStatus
      ? productStatusSchema.parse(rawStatus)
      : undefined;
    const page = Number(searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(searchParams.get("pageSize") ?? "20") || 20;

    const result = await listAdminProducts({ q, status, page, pageSize });
    return paginated(result.items, result.meta, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/products" });
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

    const input = createProductSchema.parse(rawBody);
    const product = await createProduct(input, {
      actorUserId: admin.id,
      ...extractRequestAuditMeta(request),
    });

    revalidateCatalogCache(product.slug);
    return ok(product, 201, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/products" });
  }
}
