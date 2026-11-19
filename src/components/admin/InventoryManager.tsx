"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface InventoryVariantRow {
  id: string;
  sku: string;
  label: string;
  stockOnHand: number;
  stockReserved: number;
  availableStock: number;
  product: {
    id: string;
    name: string;
    status: string;
  };
}

interface MovementRow {
  id: string;
  type: string;
  quantityDelta: number;
  reservedDelta: number;
  stockOnHandAfter: number;
  stockReservedAfter: number;
  reason: string | null;
  createdAt: string;
  product: { name: string };
  variant: { sku: string; label: string };
  actor: { name: string; email: string } | null;
}

interface InventoryManagerProps {
  initialVariants: InventoryVariantRow[];
  initialMovements: MovementRow[];
}

export function InventoryManager({
  initialVariants,
  initialMovements,
}: InventoryManagerProps) {
  const router = useRouter();
  const [variants, setVariants] = useState(initialVariants);
  const [movements, setMovements] = useState(initialMovements);
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariants[0]?.id ?? "");
  const [type, setType] = useState<"MANUAL_ADJUSTMENT_IN" | "MANUAL_ADJUSTMENT_OUT">(
    "MANUAL_ADJUSTMENT_IN",
  );
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refreshInventory() {
    const res = await fetch("/api/admin/inventory");
    const json = (await res.json()) as {
      data?: { variants: InventoryVariantRow[]; movements: MovementRow[] };
    };
    if (res.ok && json.data) {
      setVariants(json.data.variants);
      setMovements(json.data.movements);
    }
    router.refresh();
  }

  async function handleAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariantId,
          type,
          quantity: Number.parseInt(quantity, 10) || 0,
          reason,
        }),
      });

      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error?.message ?? "Nao foi possivel ajustar o estoque.",
        });
        return;
      }

      setReason("");
      setQuantity("1");
      setFeedback({ type: "ok", message: "Ajuste de estoque registrado com auditoria." });
      await refreshInventory();
    } catch {
      setFeedback({ type: "error", message: "Erro de rede ao registrar ajuste." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          role="status"
          className={`rounded-md px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "bg-status-danger-bg text-status-danger-fg"
              : "bg-status-success-bg text-status-success-fg"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <form
        onSubmit={handleAdjust}
        className="grid gap-4 rounded-lg border border-border-default bg-surface-card p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="inv-variant" className="block text-xs font-medium">
            SKU / Variante
          </label>
          <select
            id="inv-variant"
            required
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku} — {v.product.name} ({v.label}) [Disp: {v.availableStock}]
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="inv-type" className="block text-xs font-medium">
            Movimentacao
          </label>
          <select
            id="inv-type"
            value={type}
            onChange={(e) =>
              setType(e.target.value as "MANUAL_ADJUSTMENT_IN" | "MANUAL_ADJUSTMENT_OUT")
            }
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          >
            <option value="MANUAL_ADJUSTMENT_IN">Entrada (+)</option>
            <option value="MANUAL_ADJUSTMENT_OUT">Saida (-)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="inv-qty" className="block text-xs font-medium">
            Quantidade
          </label>
          <input
            id="inv-qty"
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-3">
          <label htmlFor="inv-reason" className="block text-xs font-medium">
            Motivo obrigatorio (RF35)
          </label>
          <input
            id="inv-reason"
            type="text"
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Reposicao de fornecedor ou avaria em estoque"
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting || variants.length === 0}
            className="min-h-11 w-full rounded-md bg-brand-primary px-4 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {submitting ? "Aplicando..." : "Registrar Ajuste"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-subtle text-xs text-text-muted">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Produto / Variacao</th>
              <th className="px-4 py-3 font-medium">Fisico</th>
              <th className="px-4 py-3 font-medium">Reservado</th>
              <th className="px-4 py-3 font-medium">Disponivel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {variants.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-text-primary">{v.product.name}</p>
                  <p className="text-xs text-text-muted">{v.label}</p>
                </td>
                <td className="px-4 py-3">{v.stockOnHand}</td>
                <td className="px-4 py-3">{v.stockReserved}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      v.availableStock === 0
                        ? "bg-status-danger-bg text-status-danger-fg"
                        : v.availableStock <= 3
                          ? "bg-status-warning-bg text-status-warning-fg"
                          : "bg-status-success-bg text-status-success-fg"
                    }`}
                  >
                    {v.availableStock}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-text-primary">
          Historico Recente (InventoryMovement)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border-default bg-surface-subtle text-text-muted">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Delta</th>
                <th className="px-3 py-2">Saldo Apos</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {movements.map((mov) => (
                <tr key={mov.id}>
                  <td className="px-3 py-2 text-text-muted">
                    {new Date(mov.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 font-mono">{mov.variant.sku}</td>
                  <td className="px-3 py-2 font-medium">{mov.type}</td>
                  <td className="px-3 py-2">
                    {mov.quantityDelta >= 0 ? `+${mov.quantityDelta}` : mov.quantityDelta}
                  </td>
                  <td className="px-3 py-2">
                    {mov.stockOnHandAfter} (res: {mov.stockReservedAfter})
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{mov.reason ?? "—"}</td>
                </tr>
              ))}
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-text-muted">
                    Nenhuma movimentacao registrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
