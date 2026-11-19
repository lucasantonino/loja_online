import type { Metadata } from "next";
import { CatalogListingView } from "@/components/store/CatalogListingView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Busca no Catalogo",
  description: "Busque roupas e acessorios por nome, descricao ou codigo SKU.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const term = typeof params.q === "string" ? params.q.trim() : "";

  return (
    <CatalogListingView
      title={term ? `Resultados para "${term}"` : "Buscar Produtos"}
      subtitle="Pesquise por nome, descricao ou codigo SKU."
      basePath="/busca"
      rawSearchParams={params}
    />
  );
}
