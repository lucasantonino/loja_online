"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AccountActions() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteBox, setShowDeleteBox] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleExportLgpd() {
    setExporting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/me/export");
      if (!response.ok) {
        setFeedback({ type: "error", message: "Nao foi possivel exportar seus dados." });
        return;
      }
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "meus-dados-lgpd.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback({ type: "ok", message: "Arquivo LGPD gerado e baixado." });
    } catch {
      setFeedback({ type: "error", message: "Erro ao exportar seus dados." });
    } finally {
      setExporting(false);
    }
  }

  async function handleAnonymize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/me/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmPhrase,
          password: password || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error?.message ?? "Nao foi possivel anonimizar sua conta.",
        });
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setFeedback({ type: "error", message: "Erro de rede ao solicitar exclusao." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExportLgpd}
          disabled={exporting}
          className="min-h-11 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-subtle disabled:opacity-60"
        >
          {exporting ? "Exportando..." : "Exportar meus dados (LGPD)"}
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteBox((prev) => !prev)}
          className="min-h-11 rounded-md border border-border-default px-4 py-2 text-sm font-medium text-status-danger-fg hover:bg-status-danger-bg"
        >
          Excluir / Anonimizar conta
        </button>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="min-h-11 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {loggingOut ? "Saindo..." : "Sair da conta"}
        </button>
      </div>

      {showDeleteBox ? (
        <form
          onSubmit={handleAnonymize}
          className="space-y-3 rounded-lg border border-border-default bg-surface-subtle p-4"
        >
          <p className="text-sm text-text-secondary">
            Conforme a LGPD, seus dados pessoais serao anonimizados preservando apenas o historico
            fiscal de pedidos ja realizados. Esta acao e irreversivel.
          </p>
          <div className="space-y-1">
            <label htmlFor="lgpd-phrase" className="block text-xs font-medium text-text-primary">
              Digite exatamente: <code>EXCLUIR MINHA CONTA</code>
            </label>
            <input
              id="lgpd-phrase"
              type="text"
              required
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="lgpd-password" className="block text-xs font-medium text-text-primary">
              Confirme sua senha atual
            </label>
            <input
              id="lgpd-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={deleting}
            className="min-h-11 rounded-md bg-status-danger-fg px-4 py-2 text-sm font-medium text-text-inverse disabled:opacity-60"
          >
            {deleting ? "Processando..." : "Confirmar exclusao definitiva"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
