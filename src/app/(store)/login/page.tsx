import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getServerSession();
  const { next } = await searchParams;

  if (session) {
    redirect(session.role === "ADMIN" ? "/admin" : "/conta");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-border-default bg-surface-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-text-primary">Entrar na sua conta</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Acesse seus pedidos, enderecos salvos ou o painel administrativo.
        </p>
        <div className="mt-6">
          <LoginForm nextPath={next} />
        </div>
      </div>
    </div>
  );
}
