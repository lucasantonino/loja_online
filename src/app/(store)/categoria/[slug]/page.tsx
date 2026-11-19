import type { Metadata } from "next";
import { CatalogListingView } from "@/components/store/CatalogListingView";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

async function findCategory(slug: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }
  try {
    return await prisma.category.findFirst({
      where: { slug, isActive: true },
      select: { name: true, description: true, slug: true },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategory(slug);
  const title = category?.name ?? slug.replace(/-/g, " ");

  return {
    title,
    description:
      category?.description ?? `Produtos selecionados na categoria ${title}.`,
  };
}

export default async function CategoryListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const category = await findCategory(slug);
  const displayTitle = category?.name ?? slug.replace(/-/g, " ");

  return (
    <CatalogListingView
      title={displayTitle}
      subtitle={category?.description ?? undefined}
      basePath={`/categoria/${slug}`}
      fixedCategorySlug={slug}
      rawSearchParams={queryParams}
    />
  );
}
