import { prisma } from "@/lib/db/prisma";
import { isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

interface AdminCounts {
  connected: boolean;
  products: number;
  variants: number;
  categories: number;
  deliveryZones: number;
}

async function loadAdminCounts(): Promise<AdminCounts> {
  if (!isDatabaseConfigured()) {
    return { connected: false, products: 0, variants: 0, categories: 0, deliveryZones: 0 };
  }

  try {
    const [products, variants, categories, deliveryZones] = await Promise.all([
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.productVariant.count({ where: { deletedAt: null } }),
      prisma.category.count(),
      prisma.deliveryZone.count({ where: { isActive: true } }),
    ]);

    return { connected: true, products, variants, categories, deliveryZones };
  } catch {
    return { connected: false, products: 0, variants: 0, categories: 0, deliveryZones: 0 };
  }
}

export default async function AdminHomePage() {
  const counts = await loadAdminCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Visao Geral da Operacao</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Base estrutural da loja conectada aos 23 modelos Prisma e modulos de dominio.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border-default bg-surface-card p-5">
          <p className="text-xs font-medium text-text-muted">Produtos cadastrados</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{counts.products}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-5">
          <p className="text-xs font-medium text-text-muted">Variantes / SKUs ativos</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{counts.variants}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-5">
          <p className="text-xs font-medium text-text-muted">Categorias</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{counts.categories}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-5">
          <p className="text-xs font-medium text-text-muted">Zonas de entrega ativas</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{counts.deliveryZones}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-card p-5 text-sm text-text-secondary">
        Status do Banco de Dados:{" "}
        <span
          className={
            counts.connected
              ? "font-semibold text-status-success-fg"
              : "font-semibold text-status-warning-fg"
          }
        >
          {counts.connected ? "Conectado ao PostgreSQL" : "Aguardando DATABASE_URL / Migration"}
        </span>
      </div>
    </div>
  );
}
