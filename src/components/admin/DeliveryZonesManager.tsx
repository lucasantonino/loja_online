"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatBrlFromCents, parseReaisToCents } from "@/lib/money";

export interface AdminDeliveryZoneItem {
  id: string;
  name: string;
  city: string;
  state: string;
  matchType: "CEP_RANGE" | "NEIGHBORHOOD" | "CITY_FLAT";
  cepStart: string | null;
  cepEnd: string | null;
  neighborhoods: string[];
  feeCents: number;
  freeShippingMinCents: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  estimatedLabel: string;
  isActive: boolean;
  sortOrder: number;
}

interface DeliveryZonesManagerProps {
  initialZones: AdminDeliveryZoneItem[];
}

export function DeliveryZonesManager({ initialZones }: DeliveryZonesManagerProps) {
  const router = useRouter();
  const [zones, setZones] = useState(initialZones);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [matchType, setMatchType] = useState<"CEP_RANGE" | "NEIGHBORHOOD" | "CITY_FLAT">(
    "CEP_RANGE",
  );
  const [cepStart, setCepStart] = useState("");
  const [cepEnd, setCepEnd] = useState("");
  const [neighborhoodsText, setNeighborhoodsText] = useState("");
  const [feeReais, setFeeReais] = useState("15,00");
  const [freeShippingReais, setFreeShippingReais] = useState("");
  const [estimatedDaysMin, setEstimatedDaysMin] = useState("1");
  const [estimatedDaysMax, setEstimatedDaysMax] = useState("2");
  const [estimatedLabel, setEstimatedLabel] = useState("1 a 2 dias uteis");
  const [sortOrder, setSortOrder] = useState("0");

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; message: string } | null>(null);

  async function refreshZones() {
    const res = await fetch("/api/admin/delivery-zones");
    const json = (await res.json()) as { data?: AdminDeliveryZoneItem[] };
    if (res.ok && json.data) {
      setZones(json.data);
    }
    router.refresh();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    let feeCents: number;
    let freeShippingMinCents: number | null = null;
    try {
      feeCents = parseReaisToCents(feeReais);
      if (freeShippingReais.trim()) {
        freeShippingMinCents = parseReaisToCents(freeShippingReais);
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Valor de taxa invalido.",
      });
      return;
    }

    const neighborhoods = neighborhoodsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const response = await fetch("/api/admin/delivery-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city,
          state: stateUf,
          matchType,
          cepStart: matchType === "CEP_RANGE" ? cepStart : null,
          cepEnd: matchType === "CEP_RANGE" ? cepEnd : null,
          neighborhoods: matchType === "NEIGHBORHOOD" ? neighborhoods : [],
          feeCents,
          freeShippingMinCents,
          estimatedDaysMin: Number.parseInt(estimatedDaysMin, 10) || 0,
          estimatedDaysMax: Number.parseInt(estimatedDaysMax, 10) || 0,
          estimatedLabel,
          isActive: true,
          sortOrder: Number.parseInt(sortOrder, 10) || 0,
        }),
      });

      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error?.message ?? "Erro ao criar zona de entrega.",
        });
        return;
      }

      setName("");
      setCepStart("");
      setCepEnd("");
      setNeighborhoodsText("");
      setFeedback({ type: "ok", message: "Zona de entrega criada com sucesso." });
      await refreshZones();
    } catch {
      setFeedback({ type: "error", message: "Erro de rede ao salvar zona." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(zone: AdminDeliveryZoneItem) {
    const res = await fetch(`/api/admin/delivery-zones/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !zone.isActive }),
    });
    if (res.ok) {
      await refreshZones();
    }
  }

  async function handleDelete(zone: AdminDeliveryZoneItem) {
    const res = await fetch(`/api/admin/delivery-zones/${zone.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setFeedback({ type: "ok", message: `Zona "${zone.name}" removida.` });
      await refreshZones();
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
        onSubmit={handleCreate}
        className="grid gap-4 rounded-lg border border-border-default bg-surface-card p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1">
          <label htmlFor="zone-name" className="block text-xs font-medium">
            Nome da zona
          </label>
          <input
            id="zone-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Centro"
            className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="zone-city" className="block text-xs font-medium">
            Cidade
          </label>
          <input
            id="zone-city"
            type="text"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Sao Paulo"
            className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="zone-uf" className="block text-xs font-medium">
            UF
          </label>
          <input
            id="zone-uf"
            type="text"
            required
            maxLength={2}
            value={stateUf}
            onChange={(e) => setStateUf(e.target.value.toUpperCase())}
            placeholder="SP"
            className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm uppercase"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="zone-match" className="block text-xs font-medium">
            Regra de correspondencia
          </label>
          <select
            id="zone-match"
            value={matchType}
            onChange={(e) =>
              setMatchType(e.target.value as "CEP_RANGE" | "NEIGHBORHOOD" | "CITY_FLAT")
            }
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          >
            <option value="CEP_RANGE">Faixa de CEP</option>
            <option value="NEIGHBORHOOD">Lista de Bairros</option>
            <option value="CITY_FLAT">Taxa Unica Municipal</option>
          </select>
        </div>

        {matchType === "CEP_RANGE" ? (
          <>
            <div className="space-y-1">
              <label htmlFor="zone-cep-start" className="block text-xs font-medium">
                CEP inicial (8 digitos)
              </label>
              <input
                id="zone-cep-start"
                type="text"
                required
                value={cepStart}
                onChange={(e) => setCepStart(e.target.value)}
                placeholder="01000000"
                className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="zone-cep-end" className="block text-xs font-medium">
                CEP final (8 digitos)
              </label>
              <input
                id="zone-cep-end"
                type="text"
                required
                value={cepEnd}
                onChange={(e) => setCepEnd(e.target.value)}
                placeholder="01599999"
                className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
              />
            </div>
          </>
        ) : null}

        {matchType === "NEIGHBORHOOD" ? (
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="zone-neighborhoods" className="block text-xs font-medium">
              Bairros separados por virgula
            </label>
            <input
              id="zone-neighborhoods"
              type="text"
              required
              value={neighborhoodsText}
              onChange={(e) => setNeighborhoodsText(e.target.value)}
              placeholder="Pinheiros, Jardins, Vila Madalena"
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>
        ) : null}

        <div className="space-y-1">
          <label htmlFor="zone-fee" className="block text-xs font-medium">
            Taxa (R$)
          </label>
          <input
            id="zone-fee"
            type="text"
            required
            value={feeReais}
            onChange={(e) => setFeeReais(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="zone-free-min" className="block text-xs font-medium">
            Frete gratis acima de (R$, opcional)
          </label>
          <input
            id="zone-free-min"
            type="text"
            value={freeShippingReais}
            onChange={(e) => setFreeShippingReais(e.target.value)}
            placeholder="250,00"
            className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="zone-label" className="block text-xs font-medium">
            Rotulo de prazo
          </label>
          <input
            id="zone-label"
            type="text"
            required
            value={estimatedLabel}
            onChange={(e) => setEstimatedLabel(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label htmlFor="zone-dmin" className="block text-xs font-medium">
              Dias min
            </label>
            <input
              id="zone-dmin"
              type="number"
              min={0}
              value={estimatedDaysMin}
              onChange={(e) => setEstimatedDaysMin(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="zone-dmax" className="block text-xs font-medium">
              Dias max
            </label>
            <input
              id="zone-dmax"
              type="number"
              min={0}
              value={estimatedDaysMax}
              onChange={(e) => setEstimatedDaysMax(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="zone-order" className="block text-xs font-medium">
              Ordem
            </label>
            <input
              id="zone-order"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-end lg:col-span-4">
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 rounded-md bg-brand-primary px-6 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Criar Zona de Entrega"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-subtle text-xs text-text-muted">
              <th className="px-4 py-3 font-medium">Zona</th>
              <th className="px-4 py-3 font-medium">Cidade/UF</th>
              <th className="px-4 py-3 font-medium">Regra</th>
              <th className="px-4 py-3 font-medium">Taxa / Frete Gratis</th>
              <th className="px-4 py-3 font-medium">Prazo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {zones.map((zone) => (
              <tr key={zone.id}>
                <td className="px-4 py-3 font-medium">{zone.name}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {zone.city}/{zone.state}
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  <span className="font-semibold">{zone.matchType}</span>
                  {zone.matchType === "CEP_RANGE"
                    ? `: ${zone.cepStart}–${zone.cepEnd}`
                    : zone.matchType === "NEIGHBORHOOD"
                      ? `: ${zone.neighborhoods.join(", ")}`
                      : ""}
                </td>
                <td className="px-4 py-3 text-xs">
                  <p className="font-semibold text-text-primary">
                    {formatBrlFromCents(zone.feeCents)}
                  </p>
                  {zone.freeShippingMinCents !== null ? (
                    <p className="text-text-muted">
                      Gratis &ge; {formatBrlFromCents(zone.freeShippingMinCents)}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">{zone.estimatedLabel}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      zone.isActive
                        ? "bg-status-success-bg text-status-success-fg"
                        : "bg-status-warning-bg text-status-warning-fg"
                    }`}
                  >
                    {zone.isActive ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(zone)}
                      className="min-h-9 rounded border border-border-default px-3 text-xs hover:bg-surface-subtle"
                    >
                      {zone.isActive ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(zone)}
                      className="min-h-9 rounded border border-border-default px-3 text-xs text-status-danger-fg hover:bg-status-danger-bg"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {zones.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  Nenhuma zona de entrega configurada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
