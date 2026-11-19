import Image from "next/image";
import Link from "next/link";
import { formatBrlFromCents } from "@/lib/money";
import type { PublicProductListItem } from "@/modules/catalog/catalog.service";

interface ProductCardProps {
  product: PublicProductListItem;
}

export function ProductCard({ product }: ProductCardProps) {
  const hasDiscount =
    product.compareAtPriceCents !== null &&
    product.compareAtPriceCents > product.basePriceCents;

  const isLowStock = product.inStock && product.totalAvailableStock <= 3;

  return (
    <article className="group flex flex-col rounded-lg border border-border-default bg-surface-card p-3 transition-colors hover:border-border-strong">
      <Link
        href={`/produto/${product.slug}`}
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-md bg-surface-subtle"
      >
        {product.primaryImage ? (
          <>
            <Image
              src={product.primaryImage.url}
              alt={product.primaryImage.altText}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-opacity duration-300 ${
                product.secondaryImage ? "group-hover:opacity-0" : ""
              }`}
            />
            {product.secondaryImage ? (
              <Image
                src={product.secondaryImage.url}
                alt={product.secondaryImage.altText}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-text-muted">
            {product.name}
          </div>
        )}

        {!product.inStock ? (
          <span className="absolute top-2 left-2 rounded-full bg-status-danger-bg px-2.5 py-0.5 text-[11px] font-medium text-status-danger-fg">
            Esgotado
          </span>
        ) : isLowStock ? (
          <span className="absolute top-2 left-2 rounded-full bg-status-warning-bg px-2.5 py-0.5 text-[11px] font-medium text-status-warning-fg">
            Ultimas unidades
          </span>
        ) : null}
      </Link>

      <div className="mt-3 flex flex-1 flex-col justify-between space-y-2">
        <div className="space-y-1">
          <p className="text-xs text-text-muted">{product.category.name}</p>
          <h3 className="line-clamp-2 text-sm font-medium text-text-primary">
            <Link href={`/produto/${product.slug}`} className="hover:underline">
              {product.name}
            </Link>
          </h3>
        </div>

        <div className="space-y-1.5">
          {product.colorSwatches.length > 0 ? (
            <div className="flex items-center gap-1.5" aria-label="Cores disponiveis">
              {product.colorSwatches.slice(0, 4).map((swatch) => (
                <span
                  key={swatch.slug}
                  title={swatch.value}
                  className="h-3.5 w-3.5 rounded-full border border-border-default"
                  style={{ backgroundColor: swatch.colorHex }}
                />
              ))}
              {product.colorSwatches.length > 4 ? (
                <span className="text-[11px] text-text-muted">
                  +{product.colorSwatches.length - 4}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-text-primary">
              {formatBrlFromCents(product.basePriceCents)}
            </span>
            {hasDiscount && product.compareAtPriceCents !== null ? (
              <span className="text-xs text-text-muted line-through">
                {formatBrlFromCents(product.compareAtPriceCents)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
