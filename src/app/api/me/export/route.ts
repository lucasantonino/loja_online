import { getServerSession, requireAuth } from "@/lib/auth/session";
import { getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { exportUserData } from "@/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = requireAuth(await getServerSession(request));
    const exported = await exportUserData(user.id);
    return ok(exported, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/me/export" });
  }
}
