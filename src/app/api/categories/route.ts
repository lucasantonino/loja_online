import { getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { listActiveCategories } from "@/modules/catalog/catalog.service";
import { listCategoriesQuerySchema } from "@/modules/catalog/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const url = new URL(request.url);
    const parsed = listCategoriesQuerySchema.parse({
      includeEmpty: url.searchParams.get("includeEmpty") ?? undefined,
    });

    const categories = await listActiveCategories({
      includeEmpty: parsed.includeEmpty,
    });

    return ok(categories, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/categories" });
  }
}
