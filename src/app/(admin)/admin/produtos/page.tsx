import Link from "next/link";
import { Plus } from "lucide-react";
import { formatBrlFromCents } from "@/lib/money";
import { listAdminProducts } from "@/modules/catalog/catalog.service";
import { resolveAvailableStock } from "@/modules/variants/matrix";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const { items, meta } = await listAdminProducts({
    q: params.q,
    page,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Produtos</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cadastro manual de produtos simples e variaveis com matriz de SKUs.
          </p>
        </div>

        <Link
          href="/admin/produtos/novo"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo Produto
        </Link>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por nome, slug ou SKU..."
          className="min-h-11 flex-1 rounded-md border border-border-default bg-surface-card px-3 text-sm"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md border border-border-strong bg-surface-card px-4 text-sm font-medium hover:bg-surface-subtle"
        >
          Buscar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-subtle text-xs text-text-muted">
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Preco Base</th>
              <th className="px-4 py-3 font-medium">Estoque Disp.</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {items.map((product) => {
              const totalAvailable = product.variants.reduce(
                (sum, v) => sum + resolveAvailableStock(v),
                0,
              );

              return (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{product.name}</p>
                    <p className="text-xs text-text-muted">{product.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{product.category.name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {product.hasVariants
                      ? `Variavel (${product.variants.length} SKUs)`
                      : "Simples"}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {formatBrlFromCents(product.basePriceCents)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{totalAvailable} un.</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        product.status === "ACTIVE"
                          ? "bg-status-success-bg text-status-success-fg"
                          : product.status === "ARCHIVED"
                            ? "bg-status-danger-bg text-status-danger-fg"
                            : "bg-status-warning-bg text-status-warning-fg"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/produtos/${product.id}`}
                      className="inline-flex min-h-9 items-center rounded border border-border-default px-3 text-xs font-medium hover:bg-surface-subtle"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            Pagina {meta.page} de {meta.totalPages} ({meta.total} produtos)
          </span>
          <div className="flex gap-2">
            {meta.page > 1 ? (
              <Link
                href={`/admin/produtos?page=${meta.page - 1}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                className="rounded border border-border-default px-3 py-1.5 hover:bg-surface-card"
              >
                Anterior
              </Link>
            ) : null}
            {meta.page < meta.totalPages ? (
              <Link
                href={`/admin/produtos?page=${meta.page + 1}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                className="rounded border border-border-default px-3 py-1.5 hover:bg-surface-card"
              >
                Proxima
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
