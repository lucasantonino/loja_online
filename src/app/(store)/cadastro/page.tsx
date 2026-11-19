import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Criar Conta",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getServerSession();
  const { next } = await searchParams;

  if (session) {
    redirect("/conta");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-border-default bg-surface-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-text-primary">Criar conta</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cadastre-se para finalizar compras e acompanhar seus pedidos.
        </p>
        <div className="mt-6">
          <RegisterForm nextPath={next} />
        </div>
      </div>
    </div>
  );
}
