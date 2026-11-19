"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { formatBrlFromCents } from "@/lib/money";
import {
  computeOptionAvailability,
  type AvailabilityOption,
  type AvailabilityVariant,
} from "@/modules/variants/matrix";

interface PdpImage {
  id: string;
  optionValueId: string | null;
  url: string;
  altText: string;
  isPrimary: boolean;
}

interface PdpInteractiveProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    shortDescription: string | null;
    basePriceCents: number;
    compareAtPriceCents: number | null;
    hasVariants: boolean;
    sizeGuideMarkdown: string | null;
    inStock: boolean;
    totalAvailableStock: number;
    category: { name: string; slug: string };
    images: PdpImage[];
    options: AvailabilityOption[];
    variants: Array<AvailabilityVariant & { isDefault: boolean; availableStock: number }>;
  };
}

interface QuoteFeedback {
  type: "covered" | "uncovered" | "error";
  message: string;
  feeLabel?: string;
  estimatedLabel?: string;
  pickupAvailable?: boolean;
}

export function PdpInteractive({ product }: PdpInteractiveProps) {
  const [selectedByOptionId, setSelectedByOptionId] = useState<Record<string, string | undefined>>(
    {},
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [bagFeedback, setBagFeedback] = useState<string | null>(null);

  // Simulador de entrega local
  const [cep, setCep] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteFeedback | null>(null);

  const availability = useMemo(
    () => computeOptionAvailability(product.options, product.variants, selectedByOptionId),
    [product.options, product.variants, selectedByOptionId],
  );

  const simpleDefaultVariant = !product.hasVariants ? product.variants[0] ?? null : null;
  const activeVariant = product.hasVariants ? availability.matchedVariant : simpleDefaultVariant;

  const displayPriceCents = activeVariant?.priceCents ?? product.basePriceCents;
  const displayCompareAtCents =
    activeVariant?.compareAtPriceCents ?? product.compareAtPriceCents;
  const hasDiscount =
    displayCompareAtCents !== null && displayCompareAtCents > displayPriceCents;

  // Filtrar fotos vinculadas ao valor de opcao selecionado (ex.: cor), mantendo fallback geral
  const selectedOptionValueIds = Object.values(selectedByOptionId).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const linkedImages = product.images.filter(
    (img) => img.optionValueId && selectedOptionValueIds.includes(img.optionValueId),
  );
  const galleryImages = linkedImages.length > 0 ? linkedImages : product.images;
  const currentImage = galleryImages[activeImageIndex] ?? galleryImages[0] ?? null;

  const isGlobalOutOfStock = !product.inStock;
  const isMatchedOutOfStock =
    product.hasVariants &&
    availability.allRequiredSelected &&
    (!availability.matchedVariant || !availability.isMatchedInStock);
  const buyButtonDisabled = isGlobalOutOfStock || isMatchedOutOfStock;

  function handleSelectOption(optionId: string, valueId: string, canSelect: boolean) {
    if (!canSelect) {
      return;
    }
    setSelectionError(null);
    setBagFeedback(null);
    setActiveImageIndex(0);
    setSelectedByOptionId((prev) => ({
      ...prev,
      [optionId]: prev[optionId] === valueId ? undefined : valueId,
    }));
  }

  function handleAddToBag() {
    setSelectionError(null);
    setBagFeedback(null);

    if (product.hasVariants && !availability.allRequiredSelected) {
      const missingNames = availability.options
        .filter((o) => availability.missingRequiredOptionIds.includes(o.id))
        .map((o) => o.name)
        .join(" e ");
      setSelectionError(`Selecione ${missingNames} antes de adicionar a sacola.`);
      return;
    }

    if (!activeVariant || activeVariant.availableStock <= 0) {
      setSelectionError("Esta variacao esta esgotada no momento.");
      return;
    }

    setBagFeedback(
      `Variante "${activeVariant.label}" (SKU ${activeVariant.sku}) validada com ${activeVariant.availableStock} un. em estoque. O carrinho persistente sera ativado na tarefa T09.`,
    );
  }

  async function handleQuoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuoting(true);
    setQuoteResult(null);

    try {
      const response = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep,
          subtotalCents: displayPriceCents,
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
          pickupOption?: { enabled: boolean } | null;
        };
        error?: {
          code?: string;
          message?: string;
          details?: { pickupOption?: { enabled: boolean } | null };
        };
      };

      if (response.ok && payload.data?.matchedZone) {
        const zone = payload.data.matchedZone;
        setQuoteResult({
          type: "covered",
          message: `Entrega local disponivel (${zone.name})`,
          feeLabel: zone.freeShippingApplied
            ? "Frete gratis"
            : formatBrlFromCents(zone.feeCents),
          estimatedLabel: zone.estimatedLabel,
        });
        return;
      }

      if (payload.error?.code === "OUT_OF_COVERAGE_AREA") {
        setQuoteResult({
          type: "uncovered",
          message:
            payload.error.message ?? "CEP fora da area de entrega local configurada.",
          pickupAvailable: Boolean(payload.error.details?.pickupOption?.enabled),
        });
        return;
      }

      setQuoteResult({
        type: "error",
        message: payload.error?.message ?? "Nao foi possivel consultar o CEP.",
      });
    } catch {
      setQuoteResult({
        type: "error",
        message: "Erro de rede ao consultar entrega.",
      });
    } finally {
      setQuoting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8 md:pb-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">
          Inicio
        </Link>{" "}
        /{" "}
        <Link href={`/categoria/${product.category.slug}`} className="hover:text-text-primary">
          {product.category.name}
        </Link>{" "}
        / <span className="text-text-primary">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Galeria */}
        <div className="space-y-3">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border-default bg-surface-subtle">
            {currentImage ? (
              <Image
                src={currentImage.url}
                alt={currentImage.altText}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-text-muted">
                {product.name}
              </div>
            )}
          </div>

          {galleryImages.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {galleryImages.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Ver imagem ${idx + 1}`}
                  className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-md border ${
                    idx === activeImageIndex ? "border-border-strong" : "border-border-default"
                  }`}
                >
                  <Image src={img.url} alt={img.altText} fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Informacoes & Matriz Cor x Tamanho */}
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {product.category.name}
            </p>
            <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">
              {product.name}
            </h1>
            {product.shortDescription ? (
              <p className="text-sm text-text-secondary">{product.shortDescription}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold text-text-primary">
              {formatBrlFromCents(displayPriceCents)}
            </span>
            {hasDiscount && displayCompareAtCents !== null ? (
              <span className="text-sm text-text-muted line-through">
                {formatBrlFromCents(displayCompareAtCents)}
              </span>
            ) : null}
            {isGlobalOutOfStock ? (
              <span className="rounded-full bg-status-danger-bg px-3 py-1 text-xs font-medium text-status-danger-fg">
                Produto Esgotado
              </span>
            ) : null}
          </div>

          {product.hasVariants ? (
            <div className="space-y-4">
              {availability.options.map((group) => {
                const isMissing =
                  selectionError !== null &&
                  availability.missingRequiredOptionIds.includes(group.id);

                return (
                  <fieldset key={group.id} className="space-y-2">
                    <legend className="text-sm font-medium text-text-primary">
                      {group.name}
                      {group.selectedValueId ? (
                        <span className="ml-2 font-normal text-text-secondary">
                          {group.values.find((v) => v.id === group.selectedValueId)?.value}
                        </span>
                      ) : null}
                    </legend>

                    <div
                      role="radiogroup"
                      aria-label={group.name}
                      className="flex flex-wrap gap-2"
                    >
                      {group.values.map((val) => {
                        const unavailable = !val.exists || !val.inStock;
                        return (
                          <button
                            key={val.id}
                            type="button"
                            role="radio"
                            aria-checked={val.selected}
                            aria-disabled={unavailable}
                            disabled={unavailable}
                            title={
                              unavailable ? `${val.value} esgotado nesta combinacao` : val.value
                            }
                            onClick={() => handleSelectOption(group.id, val.id, !unavailable)}
                            className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors ${
                              val.selected
                                ? "border-border-strong bg-brand-primary text-text-inverse"
                                : unavailable
                                  ? "cursor-not-allowed border-border-default bg-surface-subtle text-text-muted line-through opacity-60"
                                  : "border-border-default bg-surface-page text-text-primary hover:border-border-strong"
                            }`}
                          >
                            {val.colorHex ? (
                              <span
                                className="h-4 w-4 rounded-full border border-border-default"
                                style={{ backgroundColor: val.colorHex }}
                              />
                            ) : null}
                            <span>{val.value}</span>
                          </button>
                        );
                      })}
                    </div>

                    {isMissing ? (
                      <p className="text-xs font-medium text-status-danger-fg">
                        Escolha uma opcao de {group.name}.
                      </p>
                    ) : null}
                  </fieldset>
                );
              })}
            </div>
          ) : null}

          {activeVariant ? (
            <p className="text-xs text-text-muted" aria-live="polite">
              SKU: <code>{activeVariant.sku}</code> ·{" "}
              {activeVariant.availableStock > 0
                ? `${activeVariant.availableStock} unidade(s) disponiveis`
                : "Combinacao esgotada"}
            </p>
          ) : null}

          {selectionError ? (
            <div
              role="alert"
              className="rounded-md bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
            >
              {selectionError}
            </div>
          ) : null}

          {bagFeedback ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md bg-status-info-bg px-4 py-3 text-sm text-status-info-fg"
            >
              {bagFeedback}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleAddToBag}
            disabled={buyButtonDisabled}
            className="min-h-12 w-full rounded-md bg-brand-primary px-6 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buyButtonDisabled ? "Produto Indisponivel" : "Adicionar a Sacola"}
          </button>

          {/* Simulador de Entrega Local */}
          <form
            onSubmit={handleQuoteSubmit}
            className="space-y-3 rounded-lg border border-border-default bg-surface-subtle p-4"
          >
            <label htmlFor="pdp-cep" className="block text-sm font-medium text-text-primary">
              Simular entrega local por CEP
            </label>
            <div className="flex gap-2">
              <input
                id="pdp-cep"
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="01310-100"
                className="min-h-11 flex-1 rounded-md border border-border-default bg-surface-page px-3 text-sm"
              />
              <button
                type="submit"
                disabled={quoting}
                className="min-h-11 rounded-md border border-border-strong bg-surface-page px-4 text-sm font-medium hover:bg-surface-card disabled:opacity-60"
              >
                {quoting ? "Calculando..." : "Calcular"}
              </button>
            </div>

            {quoteResult ? (
              <div
                aria-live="polite"
                className={`rounded-md px-3 py-2 text-xs ${
                  quoteResult.type === "covered"
                    ? "bg-status-success-bg text-status-success-fg"
                    : "bg-status-warning-bg text-status-warning-fg"
                }`}
              >
                <p className="font-semibold">{quoteResult.message}</p>
                {quoteResult.feeLabel ? (
                  <p>
                    Taxa: {quoteResult.feeLabel} · Prazo: {quoteResult.estimatedLabel}
                  </p>
                ) : null}
                {quoteResult.pickupAvailable ? (
                  <p className="mt-1">Retirada gratuita na loja disponivel no checkout.</p>
                ) : null}
              </div>
            ) : null}
          </form>

          {product.sizeGuideMarkdown ? (
            <details className="rounded-lg border border-border-default bg-surface-card p-4">
              <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                Guia de Medidas
              </summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-xs text-text-secondary">
                {product.sizeGuideMarkdown}
              </pre>
            </details>
          ) : null}

          <div className="space-y-2 border-t border-border-default pt-4">
            <h2 className="text-sm font-semibold text-text-primary">Descricao</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
              {product.description}
            </p>
          </div>

          <p className="text-xs text-text-muted">
            Troca e direito de arrependimento garantidos em ate 7 dias corridos (CDC Art. 49).{" "}
            <Link href="/politicas/trocas-e-devolucoes" className="underline hover:text-text-primary">
              Ver politica completa
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border-default bg-surface-page px-4 py-3 shadow-lg md:hidden">
        <div>
          <p className="text-xs text-text-muted">{product.name}</p>
          <p className="text-sm font-semibold text-text-primary">
            {formatBrlFromCents(displayPriceCents)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddToBag}
          disabled={buyButtonDisabled}
          className="min-h-11 rounded-md bg-brand-primary px-5 text-sm font-semibold text-text-inverse disabled:opacity-50"
        >
          {buyButtonDisabled ? "Esgotado" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}
