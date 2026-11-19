import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Loja de Roupas e Acessorios",
    template: "%s | Loja de Roupas e Acessorios",
  },
  description:
    "E-commerce B2C de roupas e acessorios com entrega local e pagamento via Pix e cartao.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-surface-page text-text-primary antialiased">{children}</body>
    </html>
  );
}
