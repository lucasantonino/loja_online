"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export interface AdminCategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
}

interface CategoriesManagerProps {
  initialCategories: AdminCategoryItem[];
}

export function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function refreshList() {
    const res = await fetch("/api/admin/categories");
    const json = (await res.json()) as { data?: AdminCategoryItem[] };
    if (res.ok && json.data) {
      setCategories(json.data);
    }
    router.refresh();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parentId: parentId || null,
          description: description.trim() || null,
          sortOrder: Number.parseInt(sortOrder, 10) || 0,
          isActive: true,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error?.message ?? "Erro ao criar categoria.",
        });
        return;
      }

      setName("");
      setParentId("");
      setDescription("");
      setSortOrder("0");
      setFeedback({ type: "ok", message: "Categoria criada com sucesso." });
      await refreshList();
    } catch {
      setFeedback({ type: "error", message: "Erro de rede ao salvar categoria." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(cat: AdminCategoryItem) {
    setFeedback(null);
    const response = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    if (!response.ok) {
      setFeedback({ type: "error", message: "Nao foi possivel atualizar categoria." });
      return;
    }
    await refreshList();
  }

  async function handleDelete(cat: AdminCategoryItem) {
    setFeedback(null);
    const response = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      setFeedback({
        type: "error",
        message: payload.error?.message ?? "Nao foi possivel excluir categoria.",
      });
      return;
    }
    setFeedback({ type: "ok", message: `Categoria "${cat.name}" removida.` });
    await refreshList();
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
          <label htmlFor="cat-name" className="block text-xs font-medium text-text-primary">
            Nome da categoria
          </label>
          <input
            id="cat-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Calcas"
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="cat-parent" className="block text-xs font-medium text-text-primary">
            Categoria pai (opcional)
          </label>
          <select
            id="cat-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          >
            <option value="">Nenhuma (Raiz)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="cat-order" className="block text-xs font-medium text-text-primary">
            Ordem
          </label>
          <input
            id="cat-order"
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 w-full rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Criar categoria"}
          </button>
        </div>

        <div className="space-y-1 sm:col-span-2 lg:col-span-4">
          <label htmlFor="cat-desc" className="block text-xs font-medium text-text-primary">
            Descricao (opcional)
          </label>
          <input
            id="cat-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
          />
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-subtle text-xs text-text-muted">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Pai</th>
              <th className="px-4 py-3 font-medium">Produtos</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="px-4 py-3 font-medium text-text-primary">{cat.name}</td>
                <td className="px-4 py-3 text-text-secondary">
                  <code>{cat.slug}</code>
                </td>
                <td className="px-4 py-3 text-text-secondary">{cat.parent?.name ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{cat._count.products}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      cat.isActive
                        ? "bg-status-success-bg text-status-success-fg"
                        : "bg-status-warning-bg text-status-warning-fg"
                    }`}
                  >
                    {cat.isActive ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(cat)}
                      className="min-h-9 rounded border border-border-default px-3 text-xs font-medium hover:bg-surface-subtle"
                    >
                      {cat.isActive ? "Inativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat)}
                      className="min-h-9 rounded border border-border-default px-3 text-xs font-medium text-status-danger-fg hover:bg-status-danger-bg"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
