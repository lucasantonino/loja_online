import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recuperar Senha",
  robots: { index: false, follow: false },
};

export default async function RecoverPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-border-default bg-surface-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-text-primary">
          {token ? "Definir nova senha" : "Recuperar senha"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {token
            ? "Escolha uma nova senha forte para sua conta."
            : "Informe seu e-mail para receber um link temporario de redefinicao."}
        </p>
        <div className="mt-6">
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </div>
  );
}
