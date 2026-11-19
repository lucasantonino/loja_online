"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/store/CartContext";
import { formatBrlFromCents } from "@/lib/money";

interface CartPageClientProps {
  isAuthenticated: boolean;
}

export function CartPageClient({ isAuthenticated }: CartPageClientProps) {
  const { cart, loading, mutating, lastError, updateQuantity, removeItem } = useCart();
  const [cep, setCep] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [quoteNotice, setQuoteNotice] = useState<{
    type: "ok" | "warn";
    text: string;
  } | null>(null);

  async function handleQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuoting(true);
    setQuoteNotice(null);

    try {
      const response = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep,
          subtotalCents: cart.subtotalCents,
        }),
      });
      const payload = (await response.json()) as {
        data?: {
          matchedZone?: {
            name: string;
            feeCents: number;
            freeShippingApplied: boolean;
            estimatedLabel: string;
          };
        };
        error?: { message?: string };
      };

      if (response.ok && payload.data?.matchedZone) {
        const z = payload.data.matchedZone;
        const feeText = z.freeShippingApplied ? "Frete gratis" : formatBrlFromCents(z.feeCents);
        setQuoteNotice({
          type: "ok",
          text: `${z.name}: ${feeText} (${z.estimatedLabel})`,
        });
      } else {
        setQuoteNotice({
          type: "warn",
          text: payload.error?.message ?? "CEP fora da cobertura local.",
        });
      }
    } catch {
      setQuoteNotice({ type: "warn", text: "Erro ao consultar entrega." });
    } finally {
      setQuoting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg bg-surface-subtle" />
        <div className="h-24 animate-pulse rounded-lg bg-surface-subtle" />
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-surface-subtle p-10 text-center">
        <p className="text-lg font-medium text-text-primary">Sua sacola esta vazia</p>
        <p className="mt-1 text-sm text-text-secondary">
          Escolha roupas e acessorios no catalogo para comecar sua compra.
        </p>
        <Link
          href="/produtos"
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-brand-primary px-6 text-sm font-medium text-text-inverse"
        >
          Explorar catalogo
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {lastError ? (
          <div
            role="alert"
            className="rounded-md bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
          >
            {lastError}
          </div>
        ) : null}

        {cart.priceChanges.length > 0 ? (
          <div
            role="status"
            className="rounded-md bg-status-info-bg px-4 py-3 text-sm text-status-info-fg"
          >
            <p className="font-semibold">Atualizacao de preco detectada:</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {cart.priceChanges.map((change) => (
                <li key={change.itemId}>
                  {change.productName} ({change.variantLabel}): de{" "}
                  {formatBrlFromCents(change.oldUnitPriceCents)} para{" "}
                  {formatBrlFromCents(change.newUnitPriceCents)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {cart.stockWarnings.length > 0 ? (
          <div
            role="alert"
            className="rounded-md bg-status-warning-bg px-4 py-3 text-sm text-status-warning-fg"
          >
            <p className="font-semibold">Atencao ao estoque atual:</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {cart.stockWarnings.map((warn) => (
                <li key={warn.itemId}>
                  {warn.productName} ({warn.variantLabel}): solicitado {warn.requestedQuantity},
                  disponivel {warn.availableStock}.
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="divide-y divide-border-default rounded-lg border border-border-default bg-surface-card">
          {cart.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded bg-surface-subtle">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.imageAlt ?? item.productName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  href={`/produto/${item.productSlug}`}
                  className="font-medium text-text-primary hover:underline"
                >
                  {item.productName}
                </Link>
                <p className="text-xs text-text-secondary">
                  {item.variantLabel} · SKU <code>{item.sku}</code>
                </p>
                <p className="text-sm font-semibold text-text-primary">
                  {formatBrlFromCents(item.unitPriceCents)} / un.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex items-center rounded-md border border-border-default">
                  <button
                    type="button"
                    disabled={mutating}
                    aria-label={`Diminuir ${item.productName}`}
                    onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                    className="inline-flex h-11 w-11 items-center justify-center hover:bg-surface-subtle disabled:opacity-50"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    disabled={mutating || item.quantity >= item.availableStock}
                    aria-label={`Aumentar ${item.productName}`}
                    onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                    className="inline-flex h-11 w-11 items-center justify-center hover:bg-surface-subtle disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="w-24 text-right text-sm font-semibold text-text-primary">
                  {formatBrlFromCents(item.lineTotalCents)}
                </div>

                <button
                  type="button"
                  disabled={mutating}
                  aria-label={`Remover ${item.productName}`}
                  onClick={() => void removeItem(item.id)}
                  className="inline-flex h-11 w-11 items-center justify-center text-text-muted hover:text-status-danger-fg"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="space-y-4">
        <div className="space-y-4 rounded-lg border border-border-default bg-surface-card p-5">
          <h2 className="text-base font-semibold text-text-primary">Resumo da Sacola</h2>
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Subtotal ({cart.itemCount} itens)</span>
            <span className="font-semibold text-text-primary">
              {formatBrlFromCents(cart.subtotalCents)}
            </span>
          </div>

          <form onSubmit={handleQuote} className="space-y-2 border-t border-border-default pt-4">
            <label htmlFor="cart-cep" className="block text-xs font-medium text-text-primary">
              Estimar entrega local (CEP)
            </label>
            <div className="flex gap-2">
              <input
                id="cart-cep"
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="01310-100"
                className="min-h-11 flex-1 rounded-md border border-border-default px-3 text-sm"
              />
              <button
                type="submit"
                disabled={quoting}
                className="min-h-11 rounded-md border border-border-strong px-3 text-xs font-medium hover:bg-surface-subtle"
              >
                {quoting ? "..." : "Simular"}
              </button>
            </div>
            {quoteNotice ? (
              <p
                className={`rounded px-2.5 py-2 text-xs ${
                  quoteNotice.type === "ok"
                    ? "bg-status-success-bg text-status-success-fg"
                    : "bg-status-warning-bg text-status-warning-fg"
                }`}
              >
                {quoteNotice.text}
              </p>
            ) : null}
          </form>

          {cart.hasBlockingIssues ? (
            <p className="text-xs text-status-danger-fg">
              Corrija os itens com aviso de estoque antes de prosseguir para o checkout.
            </p>
          ) : (
            <Link
              href={isAuthenticated ? "/checkout" : "/login?next=/checkout"}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-semibold text-text-inverse hover:bg-brand-primary-hover"
            >
              {isAuthenticated ? "Ir para Checkout" : "Entrar e Finalizar Compra"}
            </Link>
          )}

          {!isAuthenticated ? (
            <p className="text-xs text-text-muted">
              Seus itens serao mantidos automaticamente ao entrar ou criar conta.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
