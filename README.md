# E-commerce de Roupas e Acessórios (`modelo_loja_online`)

Documentação técnica e comercial consolidada para produção da plataforma B2C de e-commerce de roupas e acessórios — evoluída a partir da **Especificação Técnica Inicial v1.0** para eliminar lacunas de concorrência, modelagem de variantes, precisão financeira, segurança, conformidade legal (LGPD/CDC) e operação em produção.

---

## Visão Geral do Projeto

| Característica | Definição |
| --- | --- |
| **Segmento** | Roupas e acessórios (modelo B2C, operação de lojista único) |
| **Catálogo inicial** | 50–500 produtos cadastrados manualmente (com margem arquitetural para 5.000+ SKUs) |
| **Tipos de produto** | Produtos simples e variáveis (ex.: Cor × Tamanho) unificados via estratégia *Default Variant* |
| **Pagamentos** | Pix e Cartão via camada agnóstica de gateway (`PaymentGatewayPort`) |
| **Entrega** | Entrega local configurável por zona (CEP/bairro) + opção configurável de retirada na loja |
| **Identidade visual** | Nova, criada do zero em `T02` após aprovação comercial do cliente |
| **Administração** | Painel próprio integrado (produtos, variações, estoque, pedidos, zonas de entrega, políticas e configurações) |

---

## Stack Tecnológica Recomendada

| Camada | Tecnologia | Papel no Sistema |
| --- | --- | --- |
| **Frontend & BFF** | Next.js (App Router) + TypeScript + Tailwind CSS | Loja pública mobile-first (SSR/ISR), painel administrativo e APIs/Server Actions |
| **Hospedagem App** | Vercel | Deploy contínuo, Edge/Serverless, Cron Jobs e ambientes Preview/Production |
| **Banco de Dados** | PostgreSQL (Neon ou Supabase) + Prisma ORM | Persistência relacional transacional, constraints `CHECK` e locks atômicos de estoque |
| **Pagamentos** | Adaptador `PaymentGatewayPort` (Mercado Pago / Pagar.me / Asaas) | Pix dinâmico, cartão tokenizado (PCI SAQ-A), estornos e webhooks assinados |
| **Mídia** | Cloudinary | Upload assinado server-side, otimização automática WebP/AVIF e entrega via CDN |
| **E-mail Transacional** | Resend + React Email | Confirmação de pedido, Pix pendente, mudança de status e recuperação de senha |
| **Autenticação** | Auth.js v5 (ou Better Auth) + Argon2id/bcrypt | Sessões seguras em cookies `HttpOnly`, RBAC (`CUSTOMER` / `ADMIN`) |
| **Qualidade & Observabilidade** | Vitest + Playwright + Sentry + Logs JSON | Testes unitários, integração transacional/concorrência, E2E e monitoramento de erros |

---

## Mapa da Documentação de Produção

Ordem recomendada de leitura conforme o momento do projeto:

| Ordem | Documento | Público-Alvo | Objetivo Principal |
| --- | --- | --- | --- |
| 1 | [00-GOVERNANCA-E-ROADMAP.md](./docs/00-GOVERNANCA-E-ROADMAP.md) | Gestão, Produto e Tech Lead | Fases de entrega, sequência segura de construção, backlog `T01`–`T20` com User Stories, DoR/DoD, esforço (391h / 450–490h) e riscos. |
| 2 | [01-APROVACAO-COMERCIAL-CLIENTE.md](./docs/01-APROVACAO-COMERCIAL-CLIENTE.md) | Cliente / Lojista e PO | Caderno formal de aprovação da marca/dados legais (Decreto 7.962/2013) e das **12 decisões comerciais pendentes** mapeadas para campos configuráveis. |
| 3 | [02-PRD-E-REQUISITOS.md](./docs/02-PRD-E-REQUISITOS.md) | Produto, Engenharia e QA | Personas, 6 módulos funcionais, `RF01`–`RF42`, regras de negócio (`RN01`–`RN19` + `RN20`–`RN34`), `RNF01`–`RNF14` e matriz de rastreabilidade. |
| 4 | [03-ARQUITETURA-E-SEGURANCA.md](./docs/03-ARQUITETURA-E-SEGURANCA.md) | Arquitetura e Backend | Arquitetura modular, cache/revalidação, `PaymentGatewayPort` + comparativo Mercado Pago vs Pagar.me vs Asaas, segurança OWASP e conformidade LGPD/CDC. |
| 5 | [04-MODELAGEM-DADOS-E-PRISMA.md](./docs/04-MODELAGEM-DADOS-E-PRISMA.md) | Backend e Dados | Diagrama ER definitivo (23 entidades), estratégia *Default Variant*, centavos inteiros, `schema.prisma` completo e constraints SQL de integridade. |
| 6 | [05-CONTRATOS-API-E-FLUXOS.md](./docs/05-CONTRATOS-API-E-FLUXOS.md) | Backend e Frontend | Máquinas de estado, contratos REST/Zod, merge de carrinho, webhooks idempotentes, jobs de expiração e diagramas de sequência. |
| 7 | [06-UX-ARQUITETURA-INFORMACAO-E-DESIGN.md](./docs/06-UX-ARQUITETURA-INFORMACAO-E-DESIGN.md) | Design (UI/UX) e Frontend | Sitemap Loja + Admin, anatomia das telas críticas (PDP Cor×Tamanho, Carrinho, Checkout), Design System agnóstico de marca, WCAG 2.2 AA e SEO. |
| 8 | [07-QUALIDADE-TESTES-E-GOLIVE.md](./docs/07-QUALIDADE-TESTES-E-GOLIVE.md) | QA, DevOps e Operação | Pirâmide de testes, matriz `CA01`–`CA24`, `.env.example`, CI/CD, observabilidade, backup/PITR + teste de restore, checklist de Go-Live e runbooks. |

---

## Visão Resumida das Fases de Entrega

1. **Fase 0 — Aprovação Comercial, Design e Fundação Documental (`T01`, `T02`):** Fechamento do caderno comercial pelo cliente, identidade visual, protótipo no Figma e tokens do Design System.
2. **Fase 1 — Fundação Técnica e Núcleo de Produtos (`T03`, `T04`, `T05`, `T06`, `T14`):** Setup do repositório Next.js/Prisma/PostgreSQL, modelagem de produtos simples/variáveis, upload Cloudinary, cadastro manual e controle atômico de estoque.
3. **Fase 2 — Loja Pública, Conta e Carrinho/Entrega (`T07`, `T08`, `T09`, `T10`):** Catálogo responsivo, busca e filtros, PDP com matriz Cor×Tamanho, autenticação, merge de carrinho e cotação de entrega local/retirada.
4. **Fase 3 — Checkout, Pagamentos, Pedidos e Admin MVP (`T11`, `T12`, `T13`, `T15`):** Reserva temporária de estoque, integração Pix/Cartão via adaptador, webhooks idempotentes, gestão de pedidos e Go-Live.
5. **Fase 4 — Evolução Pós-MVP (`T16`–`T20`):** E-mails transacionais avançados e dashboard P1 (`T16`, `T17`), filtros avançados P1 (`T18`), cupons promocionais P2 (`T19`) e favoritos/avaliações P2 (`T20`).

---

## Nota de Setup do Repositório Git (`T03`)

O diretório `modelo_loja_online` contém atualmente apenas esta documentação inicial e **ainda não possui um repositório Git próprio** (`.git`). Ao iniciar a tarefa **`T03`** (Setup técnico), execute `git init` diretamente dentro da pasta `modelo_loja_online` para criar um repositório isolado antes de gerar o scaffolding de Next.js, TypeScript e Prisma.
