import {
  clearSessionCookie,
  extractRequestAuditMeta,
  getServerSession,
  requireAuth,
} from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { anonymizeUserAccount } from "@/modules/auth/auth.service";
import { anonymizeAccountSchema } from "@/modules/auth/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = requireAuth(await getServerSession(request));

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = anonymizeAccountSchema.parse(rawBody);
    const result = await anonymizeUserAccount(user.id, input, extractRequestAuditMeta(request));

    const response = ok(result, 200, requestId);
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/me/anonymize" });
  }
}
