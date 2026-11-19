import { InventoryManager } from "@/components/admin/InventoryManager";
import { listAdminInventory } from "@/modules/inventory/inventory.service";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const data = await listAdminInventory();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Controle de Estoque</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Saldo fisico, reservas ativas em checkout e ajustes manuais auditados.
        </p>
      </div>

      <InventoryManager
        initialVariants={data.variants}
        initialMovements={data.movements.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
