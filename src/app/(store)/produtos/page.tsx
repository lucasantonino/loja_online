import type { Metadata } from "next";
import { CatalogListingView } from "@/components/store/CatalogListingView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalogo Completo",
  description: "Explore roupas e acessorios com filtros por categoria, tamanho, cor e preco.",
};

export default async function ProductsListingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <CatalogListingView
      title="Catalogo"
      subtitle="Filtre por categoria, tamanho, cor, faixa de preco e disponibilidade."
      basePath="/produtos"
      rawSearchParams={params}
    />
  );
}
