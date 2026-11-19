"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export interface ClientAddressItem {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  referencePoint: string | null;
  isDefault: boolean;
}

interface AddressesManagerProps {
  initialAddresses: ClientAddressItem[];
}

export function AddressesManager({ initialAddresses }: AddressesManagerProps) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<ClientAddressItem[]>(initialAddresses);
  const [label, setLabel] = useState("Casa");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [isDefault, setIsDefault] = useState(initialAddresses.length === 0);

  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; message: string } | null>(null);
  const [coverageNotice, setCoverageNotice] = useState<string | null>(null);

  async function refreshAddresses() {
    const res = await fetch("/api/addresses");
    const payload = (await res.json()) as { data?: ClientAddressItem[] };
    if (res.ok && payload.data) {
      setAddresses(payload.data);
    }
    router.refresh();
  }

  async function handleLookupCep() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setFeedback({ type: "error", message: "Informe um CEP valido com 8 digitos." });
      return;
    }

    setLookingUpCep(true);
    setFeedback(null);
    setCoverageNotice(null);

    try {
      const viaCepRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (viaCepRes.ok) {
        const data = (await viaCepRes.json()) as {
          erro?: boolean;
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
        };

        if (!data.erro) {
          if (data.logradouro) setStreet(data.logradouro);
          if (data.bairro) setNeighborhood(data.bairro);
          if (data.localidade) setCity(data.localidade);
          if (data.uf) setStateUf(data.uf);
        }
      }

      const quoteRes = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: digits,
          neighborhood: neighborhood || undefined,
          city: city || undefined,
          state: stateUf || undefined,
          subtotalCents: 0,
        }),
      });
      const quoteJson = (await quoteRes.json()) as {
        data?: { matchedZone?: { name: string; estimatedLabel: string } };
        error?: { message?: string };
      };

      if (quoteRes.ok && quoteJson.data?.matchedZone) {
        setCoverageNotice(
          `Cobertura local confirmada: ${quoteJson.data.matchedZone.name} (${quoteJson.data.matchedZone.estimatedLabel}).`,
        );
      } else {
        setCoverageNotice(
          quoteJson.error?.message ?? "Este CEP ainda esta fora da cobertura local.",
        );
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Nao foi possivel consultar o CEP automaticamente. Preencha manualmente.",
      });
    } finally {
      setLookingUpCep(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || null,
          recipientName,
          phone,
          cep,
          street,
          number,
          complement: complement.trim() || null,
          neighborhood,
          city,
          state: stateUf,
          referencePoint: referencePoint.trim() || null,
          isDefault,
        }),
      });

      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error?.message ?? "Nao foi possivel salvar o endereco.",
        });
        return;
      }

      setRecipientName("");
      setPhone("");
      setCep("");
      setStreet("");
      setNumber("");
      setComplement("");
      setNeighborhood("");
      setCity("");
      setStateUf("");
      setReferencePoint("");
      setIsDefault(false);
      setCoverageNotice(null);
      setFeedback({ type: "ok", message: "Endereco salvo com sucesso." });
      await refreshAddresses();
    } catch {
      setFeedback({ type: "error", message: "Erro de rede ao salvar endereco." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    setFeedback(null);
    const res = await fetch(`/api/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (res.ok) {
      await refreshAddresses();
    }
  }

  async function handleDelete(id: string) {
    setFeedback(null);
    const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFeedback({ type: "ok", message: "Endereco removido." });
      await refreshAddresses();
    }
  }

  return (
    <div className="space-y-8">
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

      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="flex flex-col justify-between rounded-lg border border-border-default bg-surface-card p-5"
          >
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-text-primary">
                  {addr.label ?? "Endereco"} · {addr.recipientName}
                </p>
                {addr.isDefault ? (
                  <span className="rounded-full bg-status-success-bg px-2.5 py-0.5 text-xs font-medium text-status-success-fg">
                    Principal
                  </span>
                ) : null}
              </div>
              <p className="text-text-secondary">
                {addr.street}, {addr.number}
                {addr.complement ? ` - ${addr.complement}` : ""}
              </p>
              <p className="text-text-secondary">
                {addr.neighborhood} · {addr.city}/{addr.state}
              </p>
              <p className="text-xs text-text-muted">
                CEP: {addr.cep} · Tel: {addr.phone}
              </p>
            </div>

            <div className="mt-4 flex gap-2 border-t border-border-default pt-3">
              {!addr.isDefault ? (
                <button
                  type="button"
                  onClick={() => void handleSetDefault(addr.id)}
                  className="min-h-10 rounded border border-border-default px-3 text-xs font-medium hover:bg-surface-subtle"
                >
                  Definir como principal
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleDelete(addr.id)}
                className="min-h-10 rounded border border-border-default px-3 text-xs font-medium text-status-danger-fg hover:bg-status-danger-bg"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}

        {addresses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-surface-subtle p-6 text-sm text-text-secondary sm:col-span-2">
            Nenhum endereco cadastrado ainda. Adicione abaixo o seu endereco para entrega local.
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-lg border border-border-default bg-surface-card p-5"
      >
        <h2 className="text-base font-semibold text-text-primary">Adicionar Novo Endereco</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="addr-cep" className="block text-xs font-medium">
              CEP
            </label>
            <div className="flex gap-2">
              <input
                id="addr-cep"
                type="text"
                required
                maxLength={9}
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="01310-100"
                className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleLookupCep()}
                disabled={lookingUpCep}
                className="min-h-11 shrink-0 rounded-md border border-border-strong px-3 text-xs font-medium hover:bg-surface-subtle"
              >
                {lookingUpCep ? "..." : "Buscar CEP"}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-label" className="block text-xs font-medium">
              Apelido (ex.: Casa, Trabalho)
            </label>
            <input
              id="addr-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-recipient" className="block text-xs font-medium">
              Nome do destinatario
            </label>
            <input
              id="addr-recipient"
              type="text"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-phone" className="block text-xs font-medium">
              Telefone / WhatsApp com DDD
            </label>
            <input
              id="addr-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999990000"
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="addr-street" className="block text-xs font-medium">
              Rua / Avenida
            </label>
            <input
              id="addr-street"
              type="text"
              required
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-number" className="block text-xs font-medium">
              Numero
            </label>
            <input
              id="addr-number"
              type="text"
              required
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-comp" className="block text-xs font-medium">
              Complemento (opcional)
            </label>
            <input
              id="addr-comp"
              type="text"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-neighborhood" className="block text-xs font-medium">
              Bairro
            </label>
            <input
              id="addr-neighborhood"
              type="text"
              required
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-city" className="block text-xs font-medium">
              Cidade
            </label>
            <input
              id="addr-city"
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-state" className="block text-xs font-medium">
              UF
            </label>
            <input
              id="addr-state"
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
            <label htmlFor="addr-ref" className="block text-xs font-medium">
              Ponto de referencia (opcional)
            </label>
            <input
              id="addr-ref"
              type="text"
              value={referencePoint}
              onChange={(e) => setReferencePoint(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default px-3 text-sm"
            />
          </div>
        </div>

        {coverageNotice ? (
          <p className="rounded-md bg-status-info-bg px-3 py-2 text-xs text-status-info-fg">
            {coverageNotice}
          </p>
        ) : null}

        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Definir como endereco principal</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-md bg-brand-primary px-6 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar Endereco"}
        </button>
      </form>
    </div>
  );
}
