import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountActions } from "@/components/auth/AccountActions";
import { getServerSession } from "@/lib/auth/session";
import { getAccountProfile } from "@/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Minha Conta",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?next=/conta");
  }

  const profile = await getAccountProfile(session.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Ola, {profile.name}</h1>
          <p className="text-sm text-text-secondary">{profile.email}</p>
        </div>
        {profile.role === "ADMIN" ? (
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-subtle"
          >
            Abrir Painel Admin
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/conta/pedidos"
          className="rounded-lg border border-border-default bg-surface-card p-5 transition-colors hover:border-border-strong"
        >
          <p className="font-semibold text-text-primary">Meus Pedidos</p>
          <p className="mt-1 text-sm text-text-secondary">
            Acompanhe status, codigo Pix e historico de compras.
          </p>
        </Link>
        <Link
          href="/conta/enderecos"
          className="rounded-lg border border-border-default bg-surface-card p-5 transition-colors hover:border-border-strong"
        >
          <p className="font-semibold text-text-primary">Enderecos de Entrega</p>
          <p className="mt-1 text-sm text-text-secondary">
            Gerencie seus enderecos locais salvos para entrega rapida.
          </p>
        </Link>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-card p-6">
        <h2 className="text-base font-semibold text-text-primary">Privacidade e Sessao (LGPD)</h2>
        <div className="mt-4">
          <AccountActions />
        </div>
      </div>
    </div>
  );
}
