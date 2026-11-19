"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

interface ResetPasswordFormProps {
  token?: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRequestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as {
        data?: { message?: string };
        error?: { message?: string };
      };

      if (!response.ok) {
        setErrorMessage(payload.error?.message ?? "Erro ao solicitar recuperacao.");
        return;
      }

      setStatusMessage(
        payload.data?.message ??
          "Se o e-mail estiver cadastrado, enviaremos o link de recuperacao.",
      );
    } catch {
      setErrorMessage("Erro de rede ao solicitar recuperacao.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const payload = (await response.json()) as {
        data?: { message?: string };
        error?: { message?: string };
      };

      if (!response.ok) {
        setErrorMessage(payload.error?.message ?? "Nao foi possivel redefinir a senha.");
        return;
      }

      setStatusMessage(payload.data?.message ?? "Senha redefinida com sucesso.");
    } catch {
      setErrorMessage("Erro de rede ao redefinir a senha.");
    } finally {
      setSubmitting(false);
    }
  }

  if (token) {
    return (
      <form onSubmit={handleConfirmReset} className="space-y-4" noValidate>
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-md bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
          >
            {errorMessage}
          </div>
        ) : null}
        {statusMessage ? (
          <div
            role="status"
            className="space-y-2 rounded-md bg-status-success-bg px-4 py-3 text-sm text-status-success-fg"
          >
            <p>{statusMessage}</p>
            <Link href="/login" className="inline-block font-semibold underline">
              Ir para login
            </Link>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="reset-password" className="block text-sm font-medium text-text-primary">
            Nova senha (minimo 8 caracteres, letras e numeros)
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm text-text-primary"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {submitting ? "Salvando..." : "Redefinir senha"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestReset} className="space-y-4" noValidate>
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
        >
          {errorMessage}
        </div>
      ) : null}
      {statusMessage ? (
        <div
          role="status"
          className="rounded-md bg-status-info-bg px-4 py-3 text-sm text-status-info-fg"
        >
          {statusMessage}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className="block text-sm font-medium text-text-primary">
          E-mail cadastrado
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm text-text-primary"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {submitting ? "Enviando..." : "Enviar link de recuperacao"}
      </button>

      <p className="text-center text-sm text-text-secondary">
        <Link href="/login" className="underline hover:text-text-primary">
          Voltar para login
        </Link>
      </p>
    </form>
  );
}
