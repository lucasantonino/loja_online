import { getServerSession, requireAdmin } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { prepareProductMediaUpload } from "@/modules/catalog/catalog.service";
import { signMediaUploadSchema } from "@/modules/catalog/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    requireAdmin(await getServerSession(request));

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = signMediaUploadSchema.parse(rawBody);
    const signed = await prepareProductMediaUpload(input);
    return ok(signed, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/admin/media/sign" });
  }
}
