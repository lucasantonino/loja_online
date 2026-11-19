"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/components/store/CartContext";
import { formatBrlFromCents } from "@/lib/money";

export function CartHeaderButton() {
  const { cart, openDrawer } = useCart();

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={`Abrir sacola de compras (${cart.itemCount} itens)`}
      className="relative inline-flex h-11 items-center gap-2 rounded-md border border-border-default px-3 text-sm font-medium text-text-primary hover:bg-surface-subtle"
    >
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">Sacola</span>
      <span
        aria-live="polite"
        className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 py-0.5 text-[11px] font-semibold text-text-inverse"
      >
        {cart.itemCount}
      </span>
    </button>
  );
}

export function CartDrawer() {
  const {
    cart,
    drawerOpen,
    closeDrawer,
    mutating,
    lastError,
    clearError,
    updateQuantity,
    removeItem,
  } = useCart();

  if (!drawerOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sacola de compras"
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
    >
      <div className="flex h-full w-full max-w-md flex-col bg-surface-page shadow-xl">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">
            Sacola ({cart.itemCount})
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Fechar sacola"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-subtle"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {lastError ? (
            <div
              role="alert"
              className="flex items-start justify-between gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-xs text-status-danger-fg"
            >
              <span>{lastError}</span>
              <button type="button" onClick={clearError} className="font-semibold underline">
                OK
              </button>
            </div>
          ) : null}

          {cart.priceChanges.length > 0 ? (
            <div
              role="status"
              className="rounded-md bg-status-info-bg px-3 py-2 text-xs text-status-info-fg"
            >
              Alguns itens tiveram atualizacao de preco desde a inclusao. Valores ja refletem o
              preco atual da loja.
            </div>
          ) : null}

          {cart.stockWarnings.length > 0 ? (
            <div
              role="alert"
              className="rounded-md bg-status-warning-bg px-3 py-2 text-xs text-status-warning-fg"
            >
              Ajuste ou remova itens indisponiveis/com estoque reduzido antes de finalizar.
            </div>
          ) : null}

          {cart.items.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-text-primary">Sua sacola esta vazia.</p>
              <p className="mt-1 text-xs text-text-secondary">
                Explore o catalogo para escolher pecas e tamanhos.
              </p>
              <Link
                href="/produtos"
                onClick={closeDrawer}
                className="mt-4 inline-flex min-h-11 items-center rounded-md bg-brand-primary px-5 text-sm font-medium text-text-inverse"
              >
                Ver catalogo
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border-default">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-4">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded bg-surface-subtle">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.imageAlt ?? item.productName}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      href={`/produto/${item.productSlug}`}
                      onClick={closeDrawer}
                      className="block truncate text-sm font-medium text-text-primary hover:underline"
                    >
                      {item.productName}
                    </Link>
                    <p className="text-xs text-text-secondary">{item.variantLabel}</p>
                    <p className="text-xs font-semibold text-text-primary">
                      {formatBrlFromCents(item.unitPriceCents)}
                      {item.priceChanged ? (
                        <span className="ml-2 font-normal text-status-info-fg">
                          (era {formatBrlFromCents(item.unitPriceAtAddCents)})
                        </span>
                      ) : null}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <div className="inline-flex items-center rounded border border-border-default">
                        <button
                          type="button"
                          disabled={mutating}
                          aria-label={`Diminuir quantidade de ${item.productName}`}
                          onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                          className="inline-flex h-11 w-11 items-center justify-center hover:bg-surface-subtle disabled:opacity-50"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span className="min-w-8 text-center text-xs font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={mutating || item.quantity >= item.availableStock}
                          aria-label={`Aumentar quantidade de ${item.productName}`}
                          onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                          className="inline-flex h-11 w-11 items-center justify-center hover:bg-surface-subtle disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.items.length > 0 ? (
          <div className="space-y-3 border-t border-border-default bg-surface-subtle p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Subtotal</span>
              <span className="text-base font-semibold text-text-primary">
                {formatBrlFromCents(cart.subtotalCents)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/carrinho"
                onClick={closeDrawer}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong bg-surface-page px-3 text-sm font-medium text-text-primary"
              >
                Ver sacola
              </Link>
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-3 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover"
              >
                Finalizar
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
