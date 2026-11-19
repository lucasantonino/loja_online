import { DeliveryZonesManager } from "@/components/admin/DeliveryZonesManager";
import { listAdminDeliveryZones } from "@/modules/delivery/zone.service";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage() {
  const zones = await listAdminDeliveryZones();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Zonas de Entrega Local</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure cobertura por faixa de CEP, bairros ou taxa municipal unica sem hardcode.
        </p>
      </div>

      <DeliveryZonesManager initialZones={zones} />
    </div>
  );
}
