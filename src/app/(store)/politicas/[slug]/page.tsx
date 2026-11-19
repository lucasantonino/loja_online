import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseConfigured } from "@/lib/env";
import { getStorePolicyBySlug } from "@/modules/catalog/catalog.service";

export const dynamic = "force-dynamic";

const FALLBACK_POLICIES: Record<string, { title: string; contentMarkdown: string }> = {
  "trocas-e-devolucoes": {
    title: "Politica de Trocas e Devolucoes",
    contentMarkdown:
      "Conforme o Art. 49 do Codigo de Defesa do Consumidor (CDC), voce tem o direito de arrependimento em ate 7 dias corridos apos o recebimento, com estorno integral pelo mesmo meio de pagamento.",
  },
  privacidade: {
    title: "Politica de Privacidade (LGPD)",
    contentMarkdown:
      "Seus dados pessoais sao tratados conforme a Lei Geral de Protecao de Dados (Lei 13.709/2018) exclusivamente para processamento de pedidos, entrega e atendimento.",
  },
  termos: {
    title: "Termos de Uso",
    contentMarkdown:
      "Condicoes gerais de navegacao, reservas de estoque, pagamento e entrega local da loja.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fallback = FALLBACK_POLICIES[slug];
  return {
    title: fallback?.title ?? "Politica da Loja",
  };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let policy: {
    title: string;
    contentMarkdown: string;
    version: number;
    publishedAt: Date | null;
  } | null = null;

  if (isDatabaseConfigured()) {
    try {
      policy = await getStorePolicyBySlug(slug);
    } catch {
      policy = null;
    }
  }

  const fallback = FALLBACK_POLICIES[slug];
  if (!policy && !fallback) {
    notFound();
  }

  const title = policy?.title ?? fallback!.title;
  const content = policy?.contentMarkdown ?? fallback!.contentMarkdown;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-2 border-b border-border-default pb-4">
        <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">{title}</h1>
        {policy ? (
          <p className="text-xs text-text-muted">
            Versao {policy.version} ·{" "}
            {policy.publishedAt
              ? `Publicada em ${policy.publishedAt.toLocaleDateString("pt-BR")}`
              : "Rascunho aguardando aprovacao comercial (docs/01)"}
          </p>
        ) : null}
      </div>

      <div className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
        {content}
      </div>

      <div className="pt-4">
        <Link href="/" className="text-sm font-medium text-text-primary underline">
          Voltar para a loja
        </Link>
      </div>
    </div>
  );
}
