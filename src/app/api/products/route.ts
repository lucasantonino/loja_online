import { getRequestId, handleApiError, paginated } from "@/lib/http/api-response";
import { listPublicProducts } from "@/modules/catalog/catalog.service";
import { listProductsQuerySchema } from "@/modules/catalog/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const { searchParams } = new URL(request.url);
    const colors = searchParams.getAll("color");
    const sizes = searchParams.getAll("size");

    const parsed = listProductsQuerySchema.parse({
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      color: colors.length > 0 ? colors : undefined,
      size: sizes.length > 0 ? sizes : undefined,
      minPriceCents: searchParams.get("minPriceCents") ?? undefined,
      maxPriceCents: searchParams.get("maxPriceCents") ?? undefined,
      inStockOnly: searchParams.get("inStockOnly") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    const result = await listPublicProducts(parsed);
    return paginated(result.items, result.meta, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/products" });
  }
}
