import type { Metadata } from "next";
import { CartPageClient } from "@/components/store/CartPageClient";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Minha Sacola",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const session = await getServerSession();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">Sacola de Compras</h1>
      <CartPageClient isAuthenticated={Boolean(session)} />
    </div>
  );
}
