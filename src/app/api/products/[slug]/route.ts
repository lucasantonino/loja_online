import { getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const { slug } = await context.params;
    const product = await getPublicProductBySlug(slug);
    return ok(product, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/products/[slug]" });
  }
}
