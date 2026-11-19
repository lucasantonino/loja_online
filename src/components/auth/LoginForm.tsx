"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface LoginFormProps {
  nextPath?: string;
}

export function sanitizeNextPath(nextPath?: string): string | null {
  if (!nextPath) {
    return null;
  }
  const trimmed = nextPath.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return null;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as {
        data?: { user: { role: "CUSTOMER" | "ADMIN" } };
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        setErrorMessage(payload.error?.message ?? "Nao foi possivel entrar na conta.");
        return;
      }

      const safeNext = sanitizeNextPath(nextPath);
      const target =
        safeNext ?? (payload.data.user.role === "ADMIN" ? "/admin" : "/conta");
      router.push(target);
      router.refresh();
    } catch {
      setErrorMessage("Erro de rede ao tentar entrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-border-default bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="login-email" className="block text-sm font-medium text-text-primary">
          E-mail
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm text-text-primary"
          placeholder="voce@exemplo.com.br"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="block text-sm font-medium text-text-primary">
            Senha
          </label>
          <Link
            href="/recuperar-senha"
            className="text-xs font-medium text-text-secondary underline hover:text-text-primary"
          >
            Esqueci minha senha
          </Link>
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm text-text-primary"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {submitting ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-sm text-text-secondary">
        Ainda nao possui conta?{" "}
        <Link
          href={nextPath ? `/cadastro?next=${encodeURIComponent(nextPath)}` : "/cadastro"}
          className="font-medium text-text-primary underline"
        >
          Criar cadastro
        </Link>
      </p>
    </form>
  );
}
