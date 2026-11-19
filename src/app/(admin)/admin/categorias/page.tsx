import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { listAdminCategories } from "@/modules/catalog/catalog.service";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Categorias</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Gerencie categorias e subcategorias exibidas na navegacao da loja.
        </p>
      </div>

      <CategoriesManager initialCategories={categories} />
    </div>
  );
}
