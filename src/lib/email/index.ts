import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface TransactionalEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  sent: boolean;
  skipped: boolean;
  providerMessageId?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<SendEmailResult> {
  const env = getEnv();

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    logger.info(
      { to: input.to, subject: input.subject, mode: "email_noop" },
      "RESEND_API_KEY ausente; disparo de e-mail ignorado neste ambiente",
    );
    return { sent: false, skipped: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      logger.error(
        { status: response.status, to: input.to, subject: input.subject, errorText },
        "Falha ao enviar e-mail transacional via Resend",
      );
      return { sent: false, skipped: false };
    }

    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    return {
      sent: true,
      skipped: false,
      providerMessageId: payload.id,
    };
  } catch (error) {
    logger.error(
      { err: error, to: input.to, subject: input.subject },
      "Excecao nao bloqueante ao enviar e-mail transacional",
    );
    return { sent: false, skipped: false };
  }
}

export async function sendWelcomeEmail(params: { to: string; name: string }): Promise<void> {
  const safeName = escapeHtml(params.name);
  await sendTransactionalEmail({
    to: params.to,
    subject: "Bem-vindo(a) a nossa loja",
    html: `<p>Ola, <strong>${safeName}</strong>!</p><p>Sua conta foi criada com sucesso. Voce ja pode salvar enderecos, acompanhar seus pedidos e finalizar compras com seguranca.</p>`,
    text: `Ola, ${params.name}! Sua conta foi criada com sucesso.`,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<void> {
  const safeName = escapeHtml(params.name);
  const safeUrl = escapeHtml(params.resetUrl);
  await sendTransactionalEmail({
    to: params.to,
    subject: "Recuperacao de senha",
    html: `<p>Ola, <strong>${safeName}</strong>.</p><p>Recebemos uma solicitacao para redefinir sua senha. O link abaixo e valido por ${params.expiresMinutes} minutos e pode ser usado apenas uma vez:</p><p><a href="${safeUrl}">Redefinir minha senha</a></p><p>Se voce nao solicitou esta alteracao, ignore este e-mail.</p>`,
    text: `Ola, ${params.name}. Use o link abaixo em ate ${params.expiresMinutes} minutos para redefinir sua senha: ${params.resetUrl}`,
  });
}
