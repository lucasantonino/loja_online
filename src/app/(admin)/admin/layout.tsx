import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Boxes,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Package,
  ScrollText,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Visao Geral", icon: LayoutDashboard },
  { href: "/admin/categorias", label: "Categorias", icon: FolderTree },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/estoque", label: "Estoque", icon: Boxes },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/entrega", label: "Entrega Local", icon: MapPin },
  { href: "/admin/configuracoes", label: "Configuracoes", icon: Settings },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
] as const;

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login?next=/admin");
  }

  if (session.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle p-4">
        <div className="max-w-md space-y-4 rounded-xl border border-border-default bg-surface-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Acesso Negado (403)</h1>
          <p className="text-sm text-text-secondary">
            Esta area e restrita a administradores da loja. Sua conta atual nao possui permissao{" "}
            <code>ADMIN</code>.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse"
            >
              Voltar para a loja
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle text-text-primary md:flex-row">
      <aside className="w-full border-b border-border-default bg-surface-card md:w-64 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-16 items-center justify-between border-b border-border-default px-5">
          <Link href="/admin" className="text-base font-semibold text-text-primary">
            Painel Administrativo
          </Link>
          <Link href="/" className="text-xs font-medium text-text-secondary hover:text-text-primary">
            Ver Loja
          </Link>
        </div>

        <div className="border-b border-border-default px-5 py-3 text-xs text-text-muted">
          <p className="truncate font-medium text-text-primary">{session.name}</p>
          <p className="truncate">{session.email}</p>
        </div>

        <nav aria-label="Menu administrativo" className="grid grid-cols-2 gap-1 p-3 md:grid-cols-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}
