"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sanitizeNextPath } from "@/components/auth/LoginForm";

interface RegisterFormProps {
  nextPath?: string;
}

export function RegisterForm({ nextPath }: RegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!acceptTerms) {
      setErrorMessage("Aceite os Termos de Uso e a Politica de Privacidade para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone.trim() || undefined,
          password,
          acceptTerms: true,
        }),
      });

      const payload = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        setErrorMessage(payload.error?.message ?? "Nao foi possivel concluir seu cadastro.");
        return;
      }

      const target = sanitizeNextPath(nextPath) ?? "/conta";
      router.push(target);
      router.refresh();
    } catch {
      setErrorMessage("Erro de rede ao cadastrar. Tente novamente.");
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
        <label htmlFor="reg-name" className="block text-sm font-medium text-text-primary">
          Nome completo
        </label>
        <input
          id="reg-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm text-text-primary"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-email" className="block text-sm font-medium text-text-primary">
          E-mail
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm text-text-primary"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-phone" className="block text-sm font-medium text-text-primary">
          WhatsApp / Telefone (opcional)
        </label>
        <input
          id="reg-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm text-text-primary"
          placeholder="(11) 99999-0000"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-password" className="block text-sm font-medium text-text-primary">
          Senha (minimo 8 caracteres, com letras e numeros)
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border-default bg-surface-page px-3 text-sm text-text-primary"
        />
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <span>
          Li e aceito os{" "}
          <Link href="/politicas/termos" className="underline text-text-primary">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/politicas/privacidade" className="underline text-text-primary">
            Politica de Privacidade
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {submitting ? "Criando conta..." : "Criar conta"}
      </button>

      <p className="text-center text-sm text-text-secondary">
        Ja possui conta?{" "}
        <Link
          href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
          className="font-medium text-text-primary underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
