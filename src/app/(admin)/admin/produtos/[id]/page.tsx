import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductEditorForm } from "@/components/admin/ProductEditorForm";
import { prisma } from "@/lib/db/prisma";
import { getAdminProductById, listAdminCategories } from "@/modules/catalog/catalog.service";

export const dynamic = "force-dynamic";

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: Awaited<ReturnType<typeof getAdminProductById>>;
  try {
    product = await getAdminProductById(id);
  } catch {
    notFound();
  }

  const [categories, storeConfig] = await Promise.all([
    listAdminCategories(),
    prisma.storeConfig.findUnique({
      where: { id: "default" },
      select: { maxImagesPerProduct: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{product.name}</h1>
          <p className="text-xs text-text-muted">Slug: {product.slug}</p>
        </div>
        <Link
          href={`/produto/${product.slug}`}
          className="inline-flex min-h-10 items-center rounded-md border border-border-default bg-surface-card px-3 text-xs font-medium hover:bg-surface-subtle"
        >
          Ver na loja
        </Link>
      </div>

      <ProductEditorForm
        product={product}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        maxImagesPerProduct={storeConfig?.maxImagesPerProduct ?? 8}
      />
    </div>
  );
}
