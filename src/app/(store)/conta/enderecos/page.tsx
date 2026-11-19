import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddressesManager } from "@/components/account/AddressesManager";
import { getServerSession } from "@/lib/auth/session";
import { listUserAddresses } from "@/modules/delivery/address.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meus Enderecos",
  robots: { index: false, follow: false },
};

export default async function AccountAddressesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?next=/conta/enderecos");
  }

  const addresses = await listUserAddresses(session.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Meus Enderecos</h1>
          <p className="text-sm text-text-secondary">
            Cadastre enderecos e verifique cobertura da entrega local.
          </p>
        </div>
        <Link href="/conta" className="text-sm font-medium underline">
          Voltar para conta
        </Link>
      </div>

      <AddressesManager initialAddresses={addresses} />
    </div>
  );
}
