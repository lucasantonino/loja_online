import { clearSessionCookie } from "@/lib/auth/session";
import { getRequestId, ok } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const response = ok({ loggedOut: true }, 200, requestId);
  clearSessionCookie(response);
  return response;
}
