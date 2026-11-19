import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sobre a Loja",
  description: "Informacoes institucionais e dados cadastrais do lojista.",
};

export default async function AboutPage() {
  let config: {
    storeName: string;
    legalName: string | null;
    cnpj: string | null;
    physicalAddress: string | null;
    primaryCity: string | null;
    primaryState: string | null;
  } | null = null;

  if (isDatabaseConfigured()) {
    try {
      config = await prisma.storeConfig.findUnique({
        where: { id: "default" },
        select: {
          storeName: true,
          legalName: true,
          cnpj: true,
          physicalAddress: true,
          primaryCity: true,
          primaryState: true,
        },
      });
    } catch {
      config = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold text-text-primary">
        Sobre {config?.storeName ?? "a Loja"}
      </h1>
      <p className="text-sm leading-relaxed text-text-secondary">
        Loja virtual especializada em roupas e acessorios com curadoria propria, selecao clara de
        variacoes e entrega local agil.
      </p>

      <div className="space-y-2 rounded-lg border border-border-default bg-surface-subtle p-5 text-sm text-text-secondary">
        <h2 className="font-semibold text-text-primary">
          Identificacao Legal (Decreto nº 7.962/2013)
        </h2>
        <p>Razao Social: {config?.legalName ?? "A definir apos aprovacao (docs/01)"}</p>
        <p>CNPJ: {config?.cnpj ?? "A definir"}</p>
        <p>Endereco: {config?.physicalAddress ?? "A definir"}</p>
        {config?.primaryCity ? (
          <p>
            Regiao principal de atendimento: {config.primaryCity}
            {config.primaryState ? `/${config.primaryState}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
