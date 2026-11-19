import Link from "next/link";
import type { ReactNode } from "react";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

interface StoreFooterConfig {
  storeName: string;
  legalName: string | null;
  cnpj: string | null;
  physicalAddress: string | null;
  supportEmail: string;
  supportWhatsapp: string | null;
  serviceHours: string | null;
  primaryCity: string | null;
  primaryState: string | null;
  storePickupEnabled: boolean;
}

const FALLBACK_STORE_CONFIG: StoreFooterConfig = {
  storeName: "Atelie & Vestuario",
  legalName: "Dados empresariais configuraveis em /admin/configuracoes",
  cnpj: null,
  physicalAddress: "Endereco comercial pendente de aprovacao (docs/01)",
  supportEmail: "atendimento@loja.local",
  supportWhatsapp: null,
  serviceHours: "Seg a Sex, 09h as 18h",
  primaryCity: null,
  primaryState: null,
  storePickupEnabled: false,
};

async function loadStoreConfig(): Promise<StoreFooterConfig> {
  if (!isDatabaseConfigured()) {
    return FALLBACK_STORE_CONFIG;
  }

  try {
    const config = await prisma.storeConfig.findUnique({
      where: { id: "default" },
      select: {
        storeName: true,
        legalName: true,
        cnpj: true,
        physicalAddress: true,
        supportEmail: true,
        supportWhatsapp: true,
        serviceHours: true,
        primaryCity: true,
        primaryState: true,
        storePickupEnabled: true,
      },
    });
    return config ?? FALLBACK_STORE_CONFIG;
  } catch {
    return FALLBACK_STORE_CONFIG;
  }
}

export default async function StoreLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [storeConfig, session] = await Promise.all([loadStoreConfig(), getServerSession()]);

  const coverageBanner = storeConfig.primaryCity
    ? `Entrega local em ${storeConfig.primaryCity}${storeConfig.primaryState ? `/${storeConfig.primaryState}` : ""}${storeConfig.storePickupEnabled ? " · Retirada na loja disponivel" : ""}`
    : "Entrega local configuravel por CEP e bairro · Pagamento seguro via Pix e Cartao";

  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-text-primary">
      <div className="border-b border-border-default bg-surface-subtle px-4 py-2 text-center text-xs text-text-secondary">
        {coverageBanner}
      </div>

      <header className="sticky top-0 z-30 border-b border-border-default bg-surface-page/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/produtos"
              aria-label="Abrir catalogo de categorias"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border-default text-text-primary md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link href="/" className="text-lg font-semibold tracking-tight text-text-primary">
              {storeConfig.storeName}
            </Link>
          </div>

          <nav aria-label="Navegacao principal" className="hidden items-center gap-6 md:flex">
            <Link
              href="/produtos"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Catalogo
            </Link>
            <Link
              href="/categoria/roupas"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Roupas
            </Link>
            <Link
              href="/categoria/acessorios"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Acessorios
            </Link>
            <Link
              href="/sobre"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Sobre
            </Link>
            {session?.role === "ADMIN" ? (
              <Link
                href="/admin"
                className="text-sm font-medium text-text-primary underline transition-colors hover:text-brand-accent"
              >
                Painel Admin
              </Link>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/busca"
              aria-label="Buscar produtos"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-primary hover:bg-surface-subtle"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href={session ? "/conta" : "/login"}
              aria-label={session ? "Minha conta" : "Entrar"}
              className="inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-text-primary hover:bg-surface-subtle"
            >
              <User className="h-5 w-5" aria-hidden="true" />
              <span className="hidden sm:inline">{session ? session.name.split(" ")[0] : "Entrar"}</span>
            </Link>
            <Link
              href="/carrinho"
              aria-label="Sacola de compras"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border-default px-3 text-sm font-medium text-text-primary hover:bg-surface-subtle"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              <span className="hidden sm:inline">Sacola</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border-default bg-surface-subtle">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="space-y-2 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">{storeConfig.storeName}</p>
            {storeConfig.legalName ? <p>{storeConfig.legalName}</p> : null}
            <p>CNPJ: {storeConfig.cnpj ?? "A definir (Decreto 7.962/2013)"}</p>
            {storeConfig.physicalAddress ? <p>{storeConfig.physicalAddress}</p> : null}
          </div>

          <div className="space-y-2 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Atendimento (SAC)</p>
            <p>E-mail: {storeConfig.supportEmail}</p>
            {storeConfig.supportWhatsapp ? <p>WhatsApp: {storeConfig.supportWhatsapp}</p> : null}
            {storeConfig.serviceHours ? <p>Horario: {storeConfig.serviceHours}</p> : null}
            <p>
              <Link href="/contato" className="underline hover:text-text-primary">
                Fale conosco
              </Link>
            </p>
          </div>

          <div className="space-y-2 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Politicas e Institucional</p>
            <ul className="space-y-1">
              <li>
                <Link href="/politicas/trocas-e-devolucoes" className="hover:text-text-primary">
                  Trocas e Devolucoes (CDC Art. 49)
                </Link>
              </li>
              <li>
                <Link href="/politicas/privacidade" className="hover:text-text-primary">
                  Privacidade (LGPD)
                </Link>
              </li>
              <li>
                <Link href="/politicas/termos" className="hover:text-text-primary">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link href="/sobre" className="hover:text-text-primary">
                  Sobre a Loja
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
