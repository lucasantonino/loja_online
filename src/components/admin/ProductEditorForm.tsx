"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { parseReaisToCents } from "@/lib/money";

interface AdminProductImage {
  id?: string;
  optionValueId: string | null;
  cloudinaryPublicId: string;
  url: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
}

interface AdminProductVariant {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  stockOnHand: number;
  stockReserved: number;
  isActive: boolean;
}

interface AdminProductData {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  categoryId: string;
  basePriceCents: number;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  sizeGuideMarkdown: string | null;
  images: AdminProductImage[];
  options: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; value: string }>;
  }>;
  variants: AdminProductVariant[];
}

interface ProductEditorFormProps {
  product: AdminProductData;
  categories: Array<{ id: string; name: string }>;
  maxImagesPerProduct: number;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ProductEditorForm({
  product,
  categories,
  maxImagesPerProduct,
}: ProductEditorFormProps) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [status, setStatus] = useState(product.status);
  const [basePriceReais, setBasePriceReais] = useState(centsToInput(product.basePriceCents));
  const [shortDescription, setShortDescription] = useState(product.shortDescription ?? "");
  const [description, setDescription] = useState(product.description);
  const [sizeGuideMarkdown, setSizeGuideMarkdown] = useState(product.sizeGuideMarkdown ?? "");

  const [variants, setVariants] = useState(
    product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      priceReais: centsToInput(v.priceCents),
      stockOnHand: v.stockOnHand,
      stockReserved: v.stockReserved,
      isActive: v.isActive,
    })),
  );

  const [images, setImages] = useState<AdminProductImage[]>(product.images);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; message: string } | null>(null);

  const colorOptionValues = product.options.flatMap((o) =>
    o.values.map((v) => ({ id: v.id, label: `${o.name}: ${v.value}` })),
  );

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFeedback(null);
    setUploading(true);
    try {
      const signRes = await fetch("/api/admin/media/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          contentType: file.type,
          fileSizeBytes: file.size,
        }),
      });

      const signJson = (await signRes.json()) as {
        data?: {
          apiKey: string;
          folder: string;
          timestamp: number;
          signature: string;
          uploadUrl: string;
        };
        error?: { message?: string };
      };

      if (!signRes.ok || !signJson.data) {
        setFeedback({
          type: "error",
          message: signJson.error?.message ?? "Nao foi possivel assinar upload no Cloudinary.",
        });
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signJson.data.apiKey);
      formData.append("folder", signJson.data.folder);
      formData.append("timestamp", String(signJson.data.timestamp));
      formData.append("signature", signJson.data.signature);

      const uploadRes = await fetch(signJson.data.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        setFeedback({ type: "error", message: "Erro ao enviar arquivo para o Cloudinary." });
        return;
      }

      const uploaded = (await uploadRes.json()) as {
        public_id: string;
        secure_url: string;
      };

      setImages((prev) => [
        ...prev,
        {
          optionValueId: null,
          cloudinaryPublicId: uploaded.public_id,
          url: uploaded.secure_url,
          altText: `${name} - foto ${prev.length + 1}`,
          sortOrder: prev.length,
          isPrimary: prev.length === 0,
        },
      ]);
      setFeedback({
        type: "ok",
        message: "Imagem enviada! Clique em Salvar Alteracoes para gravar no produto.",
      });
    } catch {
      setFeedback({ type: "error", message: "Erro durante upload de imagem." });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    let basePriceCents: number;
    let variantUpdates: Array<{
      id: string;
      sku: string;
      priceCents: number;
      isActive: boolean;
    }>;

    try {
      basePriceCents = parseReaisToCents(basePriceReais);
      variantUpdates = variants.map((v) => ({
        id: v.id,
        sku: v.sku.trim(),
        priceCents: parseReaisToCents(v.priceReais),
        isActive: v.isActive,
      }));
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Valor monetario invalido.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          categoryId,
          status,
          basePriceCents,
          shortDescription: shortDescription.trim() || null,
          description,
          sizeGuideMarkdown: sizeGuideMarkdown.trim() || null,
          variantUpdates,
          images: images.map((img, idx) => ({
            optionValueId: img.optionValueId,
            cloudinaryPublicId: img.cloudinaryPublicId,
            url: img.url,
            altText: img.altText,
            sortOrder: idx,
            isPrimary: img.isPrimary,
          })),
        }),
      });

      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error?.message ?? "Nao foi possivel salvar alteracoes.",
        });
        return;
      }

      setFeedback({ type: "ok", message: "Produto atualizado com sucesso." });
      router.refresh();
    } catch {
      setFeedback({ type: "error", message: "Erro de rede ao salvar produto." });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveOrDelete() {
    setFeedback(null);
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as {
      data?: { outcome: "ARCHIVED" | "DELETED" };
      error?: { message?: string };
    };

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: payload.error?.message ?? "Nao foi possivel arquivar/excluir produto.",
      });
      return;
    }

    router.push("/admin/produtos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="grid gap-4 rounded-lg border border-border-default bg-surface-card p-5 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="edit-name" className="block text-sm font-medium">
            Nome do produto
          </label>
          <input
            id="edit-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-cat" className="block text-sm font-medium">
            Categoria
          </label>
          <select
            id="edit-cat"
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
          <label htmlFor="edit-status" className="block text-sm font-medium">
            Status
          </label>
          <select
            id="edit-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminProductData["status"])}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-price" className="block text-sm font-medium">
            Preco base (R$)
          </label>
          <input
            id="edit-price"
            type="text"
            value={basePriceReais}
            onChange={(e) => setBasePriceReais(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-short" className="block text-sm font-medium">
            Resumo curto
          </label>
          <input
            id="edit-short"
            type="text"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="edit-desc" className="block text-sm font-medium">
            Descricao
          </label>
          <textarea
            id="edit-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface-page p-3 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="edit-guide" className="block text-sm font-medium">
            Guia de medidas (Markdown)
          </label>
          <textarea
            id="edit-guide"
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
              Imagens ({images.length}/{maxImagesPerProduct})
            </h2>
            <p className="text-xs text-text-secondary">
              Upload assinado direto para Cloudinary (JPEG, PNG, WebP, AVIF ate 5 MB).
            </p>
          </div>

          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-subtle">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={uploading || images.length >= maxImagesPerProduct}
              onChange={handleFileUpload}
              className="sr-only"
            />
            {uploading ? "Enviando..." : "Enviar imagem"}
          </label>
        </div>

        {images.length > 0 ? (
          <div className="space-y-3">
            {images.map((img, idx) => (
              <div
                key={`${img.cloudinaryPublicId}-${idx}`}
                className="grid gap-3 rounded-md border border-border-default p-3 sm:grid-cols-4"
              >
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-medium">Texto alternativo (alt)</label>
                  <input
                    type="text"
                    value={img.altText}
                    onChange={(e) =>
                      setImages((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, altText: e.target.value } : item,
                        ),
                      )
                    }
                    className="min-h-10 w-full rounded border border-border-default px-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium">Vincular a variacao</label>
                  <select
                    value={img.optionValueId ?? ""}
                    onChange={(e) =>
                      setImages((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, optionValueId: e.target.value || null } : item,
                        ),
                      )
                    }
                    className="min-h-10 w-full rounded border border-border-default px-2 text-xs"
                  >
                    <option value="">Todas as variacoes</option>
                    {colorOptionValues.map((optVal) => (
                      <option key={optVal.id} value={optVal.id}>
                        {optVal.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="radio"
                      name="primary-image"
                      checked={img.isPrimary}
                      onChange={() =>
                        setImages((prev) =>
                          prev.map((item, i) => ({ ...item, isPrimary: i === idx })),
                        )
                      }
                    />
                    Principal
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="min-h-9 rounded border border-border-default px-2.5 text-xs text-status-danger-fg"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Nenhuma imagem associada a este produto ainda.</p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border-default bg-surface-card p-5">
        <h2 className="text-base font-semibold text-text-primary">Variantes e Precos</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-subtle text-xs text-text-muted">
                <th className="px-3 py-2">Variacao</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Preco (R$)</th>
                <th className="px-3 py-2">Fisico / Reservado</th>
                <th className="px-3 py-2">Ativa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {variants.map((v, idx) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 font-medium">{v.label}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, sku: e.target.value } : item,
                          ),
                        )
                      }
                      className="min-h-9 w-full rounded border border-border-default px-2 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={v.priceReais}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, priceReais: e.target.value } : item,
                          ),
                        )
                      }
                      className="min-h-9 w-28 rounded border border-border-default px-2 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-text-secondary">
                    {v.stockOnHand} / {v.stockReserved} (disp: {v.stockOnHand - v.stockReserved})
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={v.isActive}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, isActive: e.target.checked } : item,
                          ),
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleArchiveOrDelete}
          className="min-h-11 rounded-md border border-border-default px-4 text-sm font-medium text-status-danger-fg hover:bg-status-danger-bg"
        >
          Arquivar / Excluir Produto
        </button>
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-md bg-brand-primary px-6 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar Alteracoes"}
        </button>
      </div>
    </form>
  );
}
