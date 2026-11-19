import { getServerSession, requireAdmin } from "@/lib/auth/session";
import { getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { listAdminInventory } from "@/modules/inventory/inventory.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    requireAdmin(await getServerSession(request));
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;

    const data = await listAdminInventory({ q });
    return ok(data, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/inventory" });
  }
}
