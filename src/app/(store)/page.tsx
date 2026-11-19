import Link from "next/link";
import { ArrowRight, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { ProductCard } from "@/components/store/ProductCard";
import { isDatabaseConfigured } from "@/lib/env";
import { listActiveCategories, listPublicProducts } from "@/modules/catalog/catalog.service";

export const dynamic = "force-dynamic";

export default async function StoreHomePage() {
  let categories: Awaited<ReturnType<typeof listActiveCategories>> = [];
  let products: Awaited<ReturnType<typeof listPublicProducts>>["items"] = [];
  let dbReady = false;

  if (isDatabaseConfigured()) {
    try {
      const [cats, catalogResult] = await Promise.all([
        listActiveCategories({ includeEmpty: true }),
        listPublicProducts({
          inStockOnly: false,
          sort: "newest",
          page: 1,
          pageSize: 8,
        }),
      ]);
      categories = cats;
      products = catalogResult.items;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-xl border border-border-default bg-surface-subtle p-6 sm:p-10">
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex items-center rounded-full bg-status-info-bg px-3 py-1 text-xs font-medium text-status-info-fg">
            Catalogo Online · Entrega Local & Retirada
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            Roupas e acessorios com grade inteligente e entrega local transparente
          </h1>
          <p className="text-base text-text-secondary">
            Explore pecas essenciais, confira disponibilidade exata por cor e tamanho em tempo
            real e pague com seguranca via Pix ou cartao.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/produtos"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-primary px-5 py-2.5 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover"
            >
              Explorar catalogo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/sobre"
              className="inline-flex min-h-11 items-center rounded-md border border-border-strong px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-page"
            >
              Conhecer a loja
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Diferenciais operacionais" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border-default bg-surface-card p-5">
          <Truck className="mb-3 h-5 w-5 text-text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text-primary">Entrega Local por Zona</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Cobertura configuravel por faixa de CEP, bairro ou cidade, sem regras hardcoded.
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-5">
          <PackageCheck className="mb-3 h-5 w-5 text-text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text-primary">Estoque Atomico e Reserva</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Protecao transacional contra venda duplicada da ultima peca e reservas Pix com TTL.
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-5">
          <ShieldCheck className="mb-3 h-5 w-5 text-text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text-primary">Conformidade CDC & LGPD</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Dados legais obrigatorios dinamicos, valores em centavos inteiros e auditoria completa.
          </p>
        </div>
      </section>

      {categories.length > 0 ? (
        <section aria-labelledby="heading-categories" className="space-y-4">
          <h2 id="heading-categories" className="text-xl font-semibold text-text-primary">
            Categorias
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categoria/${cat.slug}`}
                className="rounded-lg border border-border-default bg-surface-card p-4 transition-colors hover:border-border-strong"
              >
                <p className="font-medium text-text-primary">{cat.name}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {cat.activeProductCount} produto(s)
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="heading-featured" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="heading-featured" className="text-xl font-semibold text-text-primary">
            Destaques do Catalogo
          </h2>
          <span className="text-xs text-text-muted">
            {dbReady ? `${products.length} item(ns) ativos` : "Aguardando conexao PostgreSQL"}
          </span>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border-default bg-surface-subtle p-8 text-center">
            <p className="text-sm font-medium text-text-primary">
              Nenhum produto carregado ainda.
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Configure <code>DATABASE_URL</code> em <code>.env</code>, aplique as migrations (
              <code>npm run db:migrate:deploy</code>) e execute <code>npm run db:seed</code> para
              popular os produtos de demonstracao.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
