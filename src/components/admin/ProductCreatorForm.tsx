"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { parseReaisToCents } from "@/lib/money";
import { slugify } from "@/modules/variants/combination-key";
import { generateVariantMatrix } from "@/modules/variants/matrix";

interface CategoryOption {
  id: string;
  name: string;
}

interface EditableOptionValue {
  value: string;
  colorHex: string;
}

interface EditableOption {
  name: string;
  values: EditableOptionValue[];
}

interface VariantDraftRow {
  optionCombinationKey: string;
  optionValueSlugs: string[];
  label: string;
  sku: string;
  priceReais: string;
  initialStock: string;
}

interface ProductCreatorFormProps {
  categories: CategoryOption[];
}

export function ProductCreatorForm({ categories }: ProductCreatorFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [basePriceReais, setBasePriceReais] = useState("89,90");
  const [compareAtPriceReais, setCompareAtPriceReais] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [sizeGuideMarkdown, setSizeGuideMarkdown] = useState("");
  const [hasVariants, setHasVariants] = useState(false);

  // Simples
  const [simpleSku, setSimpleSku] = useState("");
  const [simpleStock, setSimpleStock] = useState("10");

  // Variavel
  const [options, setOptions] = useState<EditableOption[]>([
    {
      name: "Cor",
      values: [
        { value: "Preta", colorHex: "#171717" },
        { value: "Branca", colorHex: "#FAFAFA" },
      ],
    },
    {
      name: "Tamanho",
      values: [
        { value: "P", colorHex: "" },
        { value: "M", colorHex: "" },
        { value: "G", colorHex: "" },
      ],
    },
  ]);
  const [variants, setVariants] = useState<VariantDraftRow[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleGenerateMatrix() {
    setErrorMessage(null);
    const productSlug = slugify(name || "produto");

    try {
      const normalizedOptions = options
        .map((opt) => ({
          id: slugify(opt.name),
          name: opt.name.trim(),
          slug: slugify(opt.name),
          values: opt.values
            .filter((v) => v.value.trim().length > 0)
            .map((v) => {
              const valSlug = slugify(v.value);
              const optSlug = slugify(opt.name);
              return {
                id: `${optSlug}:${valSlug}`,
                value: v.value.trim(),
                slug: valSlug,
              };
            }),
        }))
        .filter((o) => o.name.length > 0 && o.values.length > 0);

      const generated = generateVariantMatrix(productSlug, normalizedOptions);
      setVariants(
        generated.map((row) => ({
          optionCombinationKey: row.optionCombinationKey,
          optionValueSlugs: row.optionValueIds,
          label: row.label,
          sku: row.suggestedSku,
          priceReais: basePriceReais,
          initialStock: "5",
        })),
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao gerar grade.");
    }
  }

  function addOption() {
    setOptions((prev) => [...prev, { name: "", values: [{ value: "", colorHex: "" }] }]);
  }

  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addOptionValue(optIdx: number) {
    setOptions((prev) =>
      prev.map((opt, i) =>
        i === optIdx ? { ...opt, values: [...opt.values, { value: "", colorHex: "" }] } : opt,
      ),
    );
  }

  function removeOptionValue(optIdx: number, valIdx: number) {
    setOptions((prev) =>
      prev.map((opt, i) =>
        i === optIdx ? { ...opt, values: opt.values.filter((_, j) => j !== valIdx) } : opt,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    let basePriceCents: number;
    let compareAtPriceCents: number | null = null;
    try {
      basePriceCents = parseReaisToCents(basePriceReais);
      if (compareAtPriceReais.trim()) {
        compareAtPriceCents = parseReaisToCents(compareAtPriceReais);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Preco invalido.");
      return;
    }

    let body: Record<string, unknown>;
    if (!hasVariants) {
      const sku = simpleSku.trim() || `${slugify(name || "PRODUTO").toUpperCase()}-UN`;
      body = {
        name,
        categoryId,
        status,
        basePriceCents,
        compareAtPriceCents,
        shortDescription: shortDescription.trim() || null,
        description,
        sizeGuideMarkdown: sizeGuideMarkdown.trim() || null,
        hasVariants: false,
        defaultVariant: {
          sku,
          initialStock: Number.parseInt(simpleStock, 10) || 0,
        },
      };
    } else {
      if (variants.length === 0) {
        setErrorMessage('Clique em "Gerar Grade de Combinacoes" antes de salvar.');
        return;
      }

      try {
        const mappedOptions = options
          .filter((o) => o.name.trim().length > 0)
          .map((o, optIdx) => ({
            name: o.name.trim(),
            isRequired: true,
            sortOrder: optIdx,
            values: o.values
              .filter((v) => v.value.trim().length > 0)
              .map((v, valIdx) => ({
                value: v.value.trim(),
                colorHex: v.colorHex.trim() || null,
                sortOrder: valIdx,
              })),
          }));

        const mappedVariants = variants.map((v) => ({
          sku: v.sku.trim(),
          label: v.label,
          priceCents: parseReaisToCents(v.priceReais),
          initialStock: Number.parseInt(v.initialStock, 10) || 0,
          isActive: true,
          optionValueSlugs: v.optionValueSlugs,
        }));

        body = {
          name,
          categoryId,
          status,
          basePriceCents,
          compareAtPriceCents,
          shortDescription: shortDescription.trim() || null,
          description,
          sizeGuideMarkdown: sizeGuideMarkdown.trim() || null,
          hasVariants: true,
          options: mappedOptions,
          variants: mappedVariants,
        };
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Erro nos valores das variantes.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        data?: { id: string };
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        setErrorMessage(payload.error?.message ?? "Nao foi possivel criar o produto.");
        return;
      }

      router.push(`/admin/produtos/${payload.data.id}`);
      router.refresh();
    } catch {
      setErrorMessage("Erro de rede ao salvar produto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-lg border border-border-default bg-surface-card p-5 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="prod-name" className="block text-sm font-medium text-text-primary">
            Nome do produto
          </label>
          <input
            id="prod-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Camiseta Basica Algodao"
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="prod-cat" className="block text-sm font-medium text-text-primary">
            Categoria
          </label>
          <select
            id="prod-cat"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="prod-status" className="block text-sm font-medium text-text-primary">
            Status de publicacao
          </label>
          <select
            id="prod-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as "DRAFT" | "ACTIVE" | "INACTIVE")}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          >
            <option value="ACTIVE">Ativo (Publicado na loja)</option>
            <option value="DRAFT">Rascunho</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="prod-price" className="block text-sm font-medium text-text-primary">
            Preco base (R$)
          </label>
          <input
            id="prod-price"
            type="text"
            required
            value={basePriceReais}
            onChange={(e) => setBasePriceReais(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="prod-compare" className="block text-sm font-medium text-text-primary">
            Preco comparacao De: (R$, opcional)
          </label>
          <input
            id="prod-compare"
            type="text"
            value={compareAtPriceReais}
            onChange={(e) => setCompareAtPriceReais(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="prod-short" className="block text-sm font-medium text-text-primary">
            Resumo curto (opcional)
          </label>
          <input
            id="prod-short"
            type="text"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="prod-desc" className="block text-sm font-medium text-text-primary">
            Descricao completa
          </label>
          <textarea
            id="prod-desc"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface-page p-3 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="prod-guide" className="block text-sm font-medium text-text-primary">
            Guia de medidas (Markdown opcional)
          </label>
          <textarea
            id="prod-guide"
            rows={3}
            value={sizeGuideMarkdown}
            onChange={(e) => setSizeGuideMarkdown(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface-page p-3 text-sm"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border-default bg-surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Estrutura de Variacoes e Estoque
            </h2>
            <p className="text-xs text-text-secondary">
              Produtos simples geram 1 variante padrao oculta (Default Variant).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHasVariants(false)}
              className={`min-h-10 rounded-md px-3 text-sm font-medium ${
                !hasVariants
                  ? "bg-brand-primary text-text-inverse"
                  : "border border-border-default bg-surface-page text-text-primary"
              }`}
            >
              Produto Simples
            </button>
            <button
              type="button"
              onClick={() => setHasVariants(true)}
              className={`min-h-10 rounded-md px-3 text-sm font-medium ${
                hasVariants
                  ? "bg-brand-primary text-text-inverse"
                  : "border border-border-default bg-surface-page text-text-primary"
              }`}
            >
              Produto Variavel (Grade)
            </button>
          </div>
        </div>

        {!hasVariants ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="simple-sku" className="block text-xs font-medium text-text-primary">
                SKU da variante padrao
              </label>
              <input
                id="simple-sku"
                type="text"
                value={simpleSku}
                onChange={(e) => setSimpleSku(e.target.value)}
                placeholder="Ex.: BOLSA-TOTE-01"
                className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="simple-stock" className="block text-xs font-medium text-text-primary">
                Estoque inicial
              </label>
              <input
                id="simple-stock"
                type="number"
                min={0}
                value={simpleStock}
                onChange={(e) => setSimpleStock(e.target.value)}
                className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {options.map((opt, optIdx) => (
              <div
                key={optIdx}
                className="space-y-3 rounded-md border border-border-default bg-surface-subtle p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={opt.name}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((item, i) =>
                          i === optIdx ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Nome da opcao (ex.: Cor, Tamanho)"
                    aria-label={`Nome da opcao ${optIdx + 1}`}
                    className="min-h-10 flex-1 rounded border border-border-default bg-surface-page px-3 text-sm"
                  />
                  {options.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeOption(optIdx)}
                      className="min-h-10 rounded border border-border-default px-3 text-xs font-medium text-status-danger-fg"
                    >
                      Remover eixo
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {opt.values.map((val, valIdx) => (
                    <div key={valIdx} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={val.value}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((item, i) =>
                              i === optIdx
                                ? {
                                    ...item,
                                    values: item.values.map((v, j) =>
                                      j === valIdx ? { ...v, value: e.target.value } : v,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="Valor (ex.: Preta, M)"
                        aria-label={`Valor ${valIdx + 1} de ${opt.name || "opcao"}`}
                        className="min-h-10 flex-1 rounded border border-border-default bg-surface-page px-3 text-sm"
                      />
                      <input
                        type="text"
                        value={val.colorHex}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((item, i) =>
                              i === optIdx
                                ? {
                                    ...item,
                                    values: item.values.map((v, j) =>
                                      j === valIdx ? { ...v, colorHex: e.target.value } : v,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="#RRGGBB (swatch opcional)"
                        aria-label={`Cor hexadecimal para ${val.value}`}
                        className="min-h-10 w-44 rounded border border-border-default bg-surface-page px-3 text-sm"
                      />
                      {opt.values.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeOptionValue(optIdx, valIdx)}
                          className="min-h-10 rounded border border-border-default px-2.5 text-xs"
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOptionValue(optIdx)}
                    className="text-xs font-medium text-text-primary underline"
                  >
                    + Adicionar valor
                  </button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addOption}
                className="min-h-11 rounded-md border border-border-default px-4 text-sm font-medium hover:bg-surface-subtle"
              >
                + Adicionar eixo de variacao
              </button>
              <button
                type="button"
                onClick={handleGenerateMatrix}
                className="min-h-11 rounded-md border border-border-strong bg-surface-subtle px-4 text-sm font-medium hover:bg-surface-page"
              >
                Gerar Grade de Combinacoes
              </button>
            </div>

            {variants.length > 0 ? (
              <div className="overflow-x-auto rounded border border-border-default">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-subtle text-xs text-text-muted">
                      <th className="px-3 py-2">Combinacao</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Preco (R$)</th>
                      <th className="px-3 py-2">Estoque Inicial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {variants.map((row, idx) => (
                      <tr key={row.optionCombinationKey}>
                        <td className="px-3 py-2 font-medium">{row.label}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            required
                            value={row.sku}
                            onChange={(e) =>
                              setVariants((prev) =>
                                prev.map((v, i) => (i === idx ? { ...v, sku: e.target.value } : v)),
                              )
                            }
                            className="min-h-9 w-full rounded border border-border-default bg-surface-page px-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            required
                            value={row.priceReais}
                            onChange={(e) =>
                              setVariants((prev) =>
                                prev.map((v, i) =>
                                  i === idx ? { ...v, priceReais: e.target.value } : v,
                                ),
                              )
                            }
                            className="min-h-9 w-28 rounded border border-border-default bg-surface-page px-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            required
                            value={row.initialStock}
                            onChange={(e) =>
                              setVariants((prev) =>
                                prev.map((v, i) =>
                                  i === idx ? { ...v, initialStock: e.target.value } : v,
                                ),
                              )
                            }
                            className="min-h-9 w-24 rounded border border-border-default bg-surface-page px-2 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-md bg-brand-primary px-6 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {submitting ? "Salvando produto..." : "Cadastrar Produto"}
        </button>
      </div>
    </form>
  );
}
