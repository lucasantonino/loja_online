import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contato e SAC",
  description: "Canais oficiais de atendimento ao consumidor.",
};

export default async function ContactPage() {
  let config: {
    storeName: string;
    supportEmail: string;
    supportWhatsapp: string | null;
    serviceHours: string | null;
    physicalAddress: string | null;
  } | null = null;

  if (isDatabaseConfigured()) {
    try {
      config = await prisma.storeConfig.findUnique({
        where: { id: "default" },
        select: {
          storeName: true,
          supportEmail: true,
          supportWhatsapp: true,
          serviceHours: true,
          physicalAddress: true,
        },
      });
    } catch {
      config = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold text-text-primary">Atendimento ao Cliente (SAC)</h1>
      <p className="text-sm text-text-secondary">
        Para duvidas sobre pedidos, entregas locais, trocas, devolucoes (CDC Art. 49) ou
        solicitacoes LGPD, utilize nossos canais oficiais:
      </p>

      <div className="space-y-3 rounded-lg border border-border-default bg-surface-card p-6 text-sm text-text-secondary">
        <p>
          <strong className="text-text-primary">E-mail SAC:</strong>{" "}
          {config?.supportEmail ?? "atendimento@loja.local"}
        </p>
        <p>
          <strong className="text-text-primary">WhatsApp / Telefone:</strong>{" "}
          {config?.supportWhatsapp ?? "A definir na aprovacao comercial"}
        </p>
        <p>
          <strong className="text-text-primary">Horario de atendimento:</strong>{" "}
          {config?.serviceHours ?? "Segunda a Sexta, 09h as 18h"}
        </p>
        <p>
          <strong className="text-text-primary">Endereco fisico:</strong>{" "}
          {config?.physicalAddress ?? "A definir na aprovacao comercial"}
        </p>
      </div>
    </div>
  );
}
