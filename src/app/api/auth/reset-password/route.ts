import { clearSessionCookie } from "@/lib/auth/session";
import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { resetPasswordWithToken } from "@/modules/auth/auth.service";
import { resetPasswordSchema } from "@/modules/auth/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = resetPasswordSchema.parse(rawBody);
    await resetPasswordWithToken(input);

    const response = ok(
      {
        passwordReset: true,
        message: "Senha redefinida com sucesso. Faca login novamente.",
      },
      200,
      requestId,
    );
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/auth/reset-password" });
  }
}
