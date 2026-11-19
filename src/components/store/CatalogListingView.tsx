import Link from "next/link";
import { CatalogFilters } from "@/components/store/CatalogFilters";
import { ProductCard } from "@/components/store/ProductCard";
import { isDatabaseConfigured } from "@/lib/env";
import {
  listActiveCategories,
  listPublicFilterFacets,
  listPublicProducts,
} from "@/modules/catalog/catalog.service";
import { listProductsQuerySchema } from "@/modules/catalog/schemas";

interface CatalogListingViewProps {
  title: string;
  subtitle?: string;
  basePath: string;
  fixedCategorySlug?: string;
  rawSearchParams: Record<string, string | string[] | undefined>;
}

function toStringArray(val: string | string[] | undefined): string[] {
  if (!val) {
    return [];
  }
  const arr = Array.isArray(val) ? val : [val];
  return arr
    .flatMap((v) => v.split(","))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export async function CatalogListingView({
  title,
  subtitle,
  basePath,
  fixedCategorySlug,
  rawSearchParams,
}: CatalogListingViewProps) {
  const parsed = listProductsQuerySchema.parse({
    q: typeof rawSearchParams.q === "string" ? rawSearchParams.q : undefined,
    category:
      fixedCategorySlug ??
      (typeof rawSearchParams.category === "string" ? rawSearchParams.category : undefined),
    color: rawSearchParams.color,
    size: rawSearchParams.size,
    minPriceCents:
      typeof rawSearchParams.minPriceCents === "string"
        ? rawSearchParams.minPriceCents
        : undefined,
    maxPriceCents:
      typeof rawSearchParams.maxPriceCents === "string"
        ? rawSearchParams.maxPriceCents
        : undefined,
    inStockOnly:
      typeof rawSearchParams.inStockOnly === "string" ? rawSearchParams.inStockOnly : undefined,
    sort: typeof rawSearchParams.sort === "string" ? rawSearchParams.sort : undefined,
    page: typeof rawSearchParams.page === "string" ? rawSearchParams.page : undefined,
    pageSize: 20,
  });

  let categories: Awaited<ReturnType<typeof listActiveCategories>> = [];
  let facets: Awaited<ReturnType<typeof listPublicFilterFacets>> = { colors: [], sizes: [] };
  let items: Awaited<ReturnType<typeof listPublicProducts>>["items"] = [];
  let meta = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

  if (isDatabaseConfigured()) {
    try {
      const [cats, facetData, productsData] = await Promise.all([
        listActiveCategories({ includeEmpty: false }),
        listPublicFilterFacets(fixedCategorySlug),
        listPublicProducts(parsed),
      ]);
      categories = cats;
      facets = facetData;
      items = productsData.items;
      meta = productsData.meta;
    } catch {
      // Fallback seguro sem banco ativo
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-border-default pb-4">
        <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
        <p className="mt-2 text-xs text-text-muted">{meta.total} produto(s) encontrado(s)</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <CatalogFilters
          basePath={basePath}
          categories={categories}
          facets={facets}
          current={{
            q: parsed.q,
            category: parsed.category,
            color: toStringArray(rawSearchParams.color),
            size: toStringArray(rawSearchParams.size),
            inStockOnly: parsed.inStockOnly,
            sort: parsed.sort,
            minPriceCents: parsed.minPriceCents,
            maxPriceCents: parsed.maxPriceCents,
          }}
        />

        <div className="flex-1 space-y-6">
          {items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border-default bg-surface-subtle p-10 text-center">
              <p className="text-base font-medium text-text-primary">
                Nenhum produto encontrado para os filtros selecionados.
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Tente limpar os filtros ou explorar outras categorias do catalogo.
              </p>
              <div className="mt-4">
                <Link
                  href="/produtos"
                  className="inline-flex min-h-11 items-center rounded-md bg-brand-primary px-5 text-sm font-medium text-text-inverse"
                >
                  Ver todo o catalogo
                </Link>
              </div>
            </div>
          )}

          {meta.totalPages > 1 ? (
            <nav
              aria-label="Paginacao do catalogo"
              className="flex items-center justify-between border-t border-border-default pt-4 text-sm"
            >
              <span className="text-text-secondary">
                Pagina {meta.page} de {meta.totalPages}
              </span>
              <div className="flex gap-2">
                {meta.page > 1 ? (
                  <Link
                    href={`${basePath}?page=${meta.page - 1}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-border-default px-4 hover:bg-surface-subtle"
                  >
                    Anterior
                  </Link>
                ) : null}
                {meta.page < meta.totalPages ? (
                  <Link
                    href={`${basePath}?page=${meta.page + 1}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-border-default px-4 hover:bg-surface-subtle"
                  >
                    Proxima
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
