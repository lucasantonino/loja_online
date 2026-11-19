"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { CategoryTreeNode } from "@/modules/catalog/catalog.service";

interface CatalogFiltersProps {
  basePath: string;
  categories: CategoryTreeNode[];
  facets: {
    colors: Array<{ value: string; slug: string; colorHex: string | null }>;
    sizes: Array<{ value: string; slug: string }>;
  };
  current: {
    q?: string;
    category?: string;
    color: string[];
    size: string[];
    inStockOnly: boolean;
    sort: "price_asc" | "price_desc" | "newest";
    minPriceCents?: number;
    maxPriceCents?: number;
  };
}

export function CatalogFilters({ basePath, categories, facets, current }: CatalogFiltersProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(current.q ?? "");
  const [selectedColors, setSelectedColors] = useState<string[]>(current.color);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(current.size);
  const [inStockOnly, setInStockOnly] = useState(current.inStockOnly);
  const [sort, setSort] = useState(current.sort);
  const [minPrice, setMinPrice] = useState(
    current.minPriceCents !== undefined ? String(Math.floor(current.minPriceCents / 100)) : "",
  );
  const [maxPrice, setMaxPrice] = useState(
    current.maxPriceCents !== undefined ? String(Math.floor(current.maxPriceCents / 100)) : "",
  );

  function buildTargetUrl(overrides?: {
    q?: string;
    colors?: string[];
    sizes?: string[];
    inStockOnly?: boolean;
    sort?: "price_asc" | "price_desc" | "newest";
    minPrice?: string;
    maxPrice?: string;
    categorySlug?: string;
  }) {
    const params = new URLSearchParams();
    const qVal = overrides?.q ?? searchTerm;
    const colorsVal = overrides?.colors ?? selectedColors;
    const sizesVal = overrides?.sizes ?? selectedSizes;
    const stockVal = overrides?.inStockOnly ?? inStockOnly;
    const sortVal = overrides?.sort ?? sort;
    const minVal = overrides?.minPrice ?? minPrice;
    const maxVal = overrides?.maxPrice ?? maxPrice;

    if (qVal.trim()) {
      params.set("q", qVal.trim());
    }
    if (overrides?.categorySlug) {
      params.set("category", overrides.categorySlug);
    } else if (current.category && basePath === "/produtos") {
      params.set("category", current.category);
    }
    for (const c of colorsVal) {
      params.append("color", c);
    }
    for (const s of sizesVal) {
      params.append("size", s);
    }
    if (stockVal) {
      params.set("inStockOnly", "true");
    }
    if (sortVal !== "newest") {
      params.set("sort", sortVal);
    }
    const minNum = Number.parseInt(minVal, 10);
    if (Number.isFinite(minNum) && minNum >= 0) {
      params.set("minPriceCents", String(minNum * 100));
    }
    const maxNum = Number.parseInt(maxVal, 10);
    if (Number.isFinite(maxNum) && maxNum >= 0) {
      params.set("maxPriceCents", String(maxNum * 100));
    }

    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  function applyFilters(event?: FormEvent) {
    event?.preventDefault();
    router.push(buildTargetUrl());
    setMobileOpen(false);
  }

  function toggleValue(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function clearAll() {
    setSearchTerm("");
    setSelectedColors([]);
    setSelectedSizes([]);
    setInStockOnly(false);
    setSort("newest");
    setMinPrice("");
    setMaxPrice("");
    router.push(basePath);
    setMobileOpen(false);
  }

  const filterFormBody = (
    <form onSubmit={applyFilters} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="filter-q" className="block text-xs font-semibold uppercase text-text-muted">
          Busca
        </label>
        <input
          id="filter-q"
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Nome, tecido ou SKU..."
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="filter-sort"
          className="block text-xs font-semibold uppercase text-text-muted"
        >
          Ordenar por
        </label>
        <select
          id="filter-sort"
          value={sort}
          onChange={(e) => {
            const nextSort = e.target.value as "price_asc" | "price_desc" | "newest";
            setSort(nextSort);
            router.push(buildTargetUrl({ sort: nextSort }));
          }}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
        >
          <option value="newest">Mais recentes</option>
          <option value="price_asc">Menor preco</option>
          <option value="price_desc">Maior preco</option>
        </select>
      </div>

      {categories.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-text-muted">Categorias</p>
          <ul className="space-y-1 text-sm">
            {categories.map((cat) => (
              <li key={cat.id}>
                <a
                  href={`/categoria/${cat.slug}`}
                  className={`block rounded px-2 py-1.5 hover:bg-surface-subtle ${
                    current.category === cat.slug
                      ? "font-semibold text-text-primary underline"
                      : "text-text-secondary"
                  }`}
                >
                  {cat.name}
                </a>
                {cat.children.length > 0 ? (
                  <ul className="ml-3 space-y-1 border-l border-border-default pl-2">
                    {cat.children.map((child) => (
                      <li key={child.id}>
                        <a
                          href={`/categoria/${child.slug}`}
                          className={`block rounded px-2 py-1 text-xs hover:bg-surface-subtle ${
                            current.category === child.slug
                              ? "font-semibold text-text-primary underline"
                              : "text-text-secondary"
                          }`}
                        >
                          {child.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {facets.sizes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-text-muted">Tamanhos</p>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => {
              const active = selectedSizes.includes(size.slug);
              return (
                <button
                  key={size.slug}
                  type="button"
                  onClick={() => setSelectedSizes((prev) => toggleValue(prev, size.slug))}
                  aria-pressed={active}
                  className={`min-h-11 min-w-11 rounded-md border px-3 text-xs font-medium transition-colors ${
                    active
                      ? "border-border-strong bg-brand-primary text-text-inverse"
                      : "border-border-default bg-surface-page text-text-primary hover:bg-surface-subtle"
                  }`}
                >
                  {size.value}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {facets.colors.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-text-muted">Cores</p>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((color) => {
              const active = selectedColors.includes(color.slug);
              return (
                <button
                  key={color.slug}
                  type="button"
                  onClick={() => setSelectedColors((prev) => toggleValue(prev, color.slug))}
                  aria-pressed={active}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors ${
                    active
                      ? "border-border-strong bg-brand-primary text-text-inverse"
                      : "border-border-default bg-surface-page text-text-primary hover:bg-surface-subtle"
                  }`}
                >
                  {color.colorHex ? (
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-border-default"
                      style={{ backgroundColor: color.colorHex }}
                    />
                  ) : null}
                  <span>{color.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-text-muted">Faixa de preco (R$)</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            aria-label="Preco minimo em reais"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
          <input
            type="number"
            min={0}
            aria-label="Preco maximo em reais"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
          className="h-4 w-4"
        />
        <span>Somente disponiveis em estoque</span>
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-11 flex-1 rounded-md bg-brand-primary px-4 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover"
        >
          Aplicar filtros
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="min-h-11 rounded-md border border-border-default px-3 text-sm text-text-secondary hover:bg-surface-subtle"
        >
          Limpar
        </button>
      </div>
    </form>
  );

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-surface-card px-4 text-sm font-medium text-text-primary"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtrar e Ordenar
        </button>
      </div>

      {mobileOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtros do catalogo"
          className="fixed inset-0 z-50 flex justify-end bg-black/40 lg:hidden"
        >
          <div className="h-full w-full max-w-sm overflow-y-auto bg-surface-page p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3">
              <p className="font-semibold text-text-primary">Filtrar e Ordenar</p>
              <button
                type="button"
                aria-label="Fechar filtros"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-subtle"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {filterFormBody}
          </div>
        </div>
      ) : null}

      <aside className="hidden lg:block lg:w-64 lg:shrink-0">
        <div className="rounded-lg border border-border-default bg-surface-card p-5">
          {filterFormBody}
        </div>
      </aside>
    </>
  );
}
