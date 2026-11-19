import { ProductCreatorForm } from "@/components/admin/ProductCreatorForm";
import { listAdminCategories } from "@/modules/catalog/catalog.service";

export const dynamic = "force-dynamic";

export default async function AdminNewProductPage() {
  const categories = await listAdminCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Novo Produto</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cadastre um produto simples ou gere a grade de combinacoes e SKUs.
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border border-border-default bg-status-warning-bg p-5 text-sm text-status-warning-fg">
          Cadastre ao menos uma categoria antes de criar um produto.
        </div>
      ) : (
        <ProductCreatorForm
          categories={categories.map((c) => ({
            id: c.id,
            name: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
          }))}
        />
      )}
    </div>
  );
}
