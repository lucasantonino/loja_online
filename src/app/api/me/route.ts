import { getServerSession, requireAuth } from "@/lib/auth/session";
import { getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { getAccountProfile } from "@/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = requireAuth(await getServerSession(request));
    const profile = await getAccountProfile(user.id);
    return ok(profile, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/me" });
  }
}
