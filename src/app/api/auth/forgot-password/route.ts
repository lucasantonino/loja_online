import { BadRequestError, getRequestId, handleApiError, ok } from "@/lib/http/api-response";
import { enforceRateLimit, extractClientIp } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/modules/auth/auth.service";
import { forgotPasswordSchema } from "@/modules/auth/schemas";

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

    const input = forgotPasswordSchema.parse(rawBody);
    const clientIp = extractClientIp(request);

    await enforceRateLimit({
      bucket: "forgotPassword",
      identifier: `${clientIp}:${input.email}`,
    });

    await requestPasswordReset(input.email);

    // Resposta sempre neutra para prevenir enumeracao de contas
    return ok(
      {
        message:
          "Se existir uma conta ativa com este e-mail, enviaremos as instrucoes de recuperacao.",
      },
      200,
      requestId,
    );
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/auth/forgot-password" });
  }
}
