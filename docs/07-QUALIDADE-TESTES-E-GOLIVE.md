# 07 — Qualidade, Matriz de Testes (`CA01`–`CA24`), Ambientes, Backups e Go-Live

Este documento estabelece a estratégia completa de garantia de qualidade, a matriz verificável de critérios de aceite (cobrindo **100% de `CA01`–`CA15`** e os critérios adicionais de produção **`CA16`–`CA24`**), a configuração de ambientes e variáveis, o pipeline CI/CD, observabilidade, rotina testada de backup/restore, checklist de Go-Live e runbooks de incidentes.

---

## 1. Estratégia de Testes em Camadas

| Camada | Ferramenta | Escopo Principal | Quando Roda |
| --- | --- | --- | --- |
| **Testes Unitários** | Vitest | Aritmética em centavos, gerador de `optionCombinationKey`, transições das máquinas de estado (`OrderStatus`, `DeliveryStatus`, `StockReservationStatus`), motor de match `DeliveryZone` (CEP/bairro/cidade), regras de merge de carrinho e validações Zod. | A cada push / PR (CI) |
| **Testes de Integração** | Vitest + PostgreSQL real | Transações Prisma: reserva e baixa atômica de estoque, violação de constraints `CHECK` negativas, deduplicação de `WebhookEvent` (`CA10`), rejeição de preço adulterado (`CA07`), checagem IDOR (`CA14`) e **teste de concorrência real com `Promise.all`** (`CA11`). | A cada PR contra container Postgres no CI |
| **Testes E2E (UI & Fluxos)** | Playwright (Desktop `1280×800` + Mobile `390×844`) | Jornada completa: cadastro/login + merge de carrinho, seleção Cor×Tamanho (`CA04`/`CA05`), bloqueio fora de cobertura (`CA12`), checkout Pix & Cartão em sandbox, fluxo Admin de produto/pedido e checagem visual sem overflow horizontal (`CA15`). | Em Preview Deploy / pré-release |

### Padrão Obrigatório para Teste de Concorrência (`CA11`)
O teste automatizado de integração deve criar uma `ProductVariant` com `stockOnHand = 1` e `stockReserved = 0`, abrir 3 carrinhos/sessões de clientes distintos e disparar simultaneamente com `Promise.allSettled`:
- Exatamente **1** requisição deve retornar `201 Created` (`stockReserved = 1`, `StockReservation = ACTIVE`).
- As outras **2** requisições devem retornar `409 Conflict (OUT_OF_STOCK)`.
- Ao final, `stockOnHand` permanece `1`, `stockReserved` permanece `1`, e o saldo disponível (`stockOnHand - stockReserved`) é `0` (jamais negativo).

---

## 2. Matriz Completa de Critérios de Aceite (`CA01`–`CA24`)

### 2.1. Critérios Originais Preservados (`CA01`–`CA15`)

| ID | Cenário | Pré-condições | Passos de Verificação | Resultado Esperado | Camada | RNs |
| --- | --- | --- | --- | --- | --- | --- |
| **CA01** | Cadastrar produto simples | Admin autenticado; categoria ativa | Criar produto com `hasVariants = false`, preço e estoque inicial `10` via `/admin/produtos/novo`. | Produto salvo (`ACTIVE`); 1 variante padrão oculta (`isDefault = true`) criada com SKU próprio; visível na loja. | Integração + E2E | `RN01`–`RN03`, `RN20` |
| **CA02** | Cadastrar produto variável | Admin autenticado | Criar "Camiseta Básica" (`hasVariants = true`), opções `Cor` (Preta, Branca) e `Tamanho` (P, M, G), definir estoque por combinação e publicar. | Todas as variantes criadas com `optionCombinationKey` único e SKUs distintos; duplicação de combinação bloqueada. | Integração + E2E | `RN04`, `RN05`, `RN21` |
| **CA03** | Consultar produto sem estoque | Produto com todas as variantes com `stockOnHand - stockReserved = 0` | Acessar PLP e PDP do produto na loja. | Produto aparece claramente como esgotado; botão de compra desabilitado/indisponível (`RN07`). | E2E | `RN07`, `RN23` |
| **CA04** | Selecionar tamanho e cor | Camiseta com Preta/Branca × P/M/G (`Branca+M = 0`, demais > 0) | Na PDP, selecionar `Preta` e `M`, depois adicionar ao carrinho. | Combinação exata (`variantId` de `Preta + M`) identificada e adicionada com seu SKU/preço corretos. | E2E | `RN04`, `RN10` |
| **CA05** | Selecionar variação esgotada | Mesma grade do `CA04` (`Branca + M = 0`) | Selecionar `Branca`; verificar estado de `M`; tentar forçar `POST /api/cart/items` com `variantId` de `Branca + M`. | Na UI, `M` aparece indisponível sem bloquear `P` e `G`; na API, retorna erro bloqueando inclusão. | Integração + E2E | `RN07`, `RN11` |
| **CA06** | Alterar quantidade | Carrinho com 1 unidade de variante com estoque `5` | Alterar quantidade para `3` e depois tentar `6`. | Subtotal recalculado no servidor para `3 × unitPriceCents`; alteração para `6` bloqueada com aviso de estoque. | Integração + E2E | `RN11`, `RN12` |
| **CA07** | Tentar alterar preço pelo navegador | Carrinho pronto para checkout | Interceptar requisição HTTP e enviar campo adulterado (ex.: `totalCents: 100`) para `POST /api/checkout`. | Servidor ignora/rejeita valores do cliente e calcula `subtotalCents`, `deliveryFeeCents` e `totalCents` exclusivamente via PostgreSQL. | Integração | `RN08`, `RN12` |
| **CA08** | Realizar pagamento Pix | Pedido elegível em checkout; gateway sandbox ativo | Selecionar `PIX` e finalizar checkout; simular confirmação no webhook/sandbox. | `Order(AWAITING_PAYMENT)` + `StockReservation(ACTIVE)` criados; QR/Copia e Cola retornado; após webhook, pedido muda para `PAID` e estoque baixa definitivamente. | Integração + E2E | `RN17`, `RN24` |
| **CA09** | Realizar pagamento com cartão | Pedido elegível; tokens de cartão aprovado e recusado do sandbox | Submeter compra com cartão aprovado e outra com cartão recusado. | Cartão aprovado confirma pedido (`PAID`) e baixa estoque; cartão recusado marca falha, libera reserva atomicamente e mantém estoque disponível. | Integração + E2E | `RN17`, `RN24` |
| **CA10** | Receber webhook duplicado | Pedido `AWAITING_PAYMENT` com `Payment(PENDING)` | Enviar o mesmo evento de aprovação (mesmo `provider` e `externalEventId`) 2 vezes com assinatura válida. | 1º evento processa normalmente; 2º retorna `200` com `duplicated: true`, sem baixar estoque 2x nem duplicar `InventoryMovement`. | Integração | `RN29` |
| **CA11** | Comprar último item disponível | Variante com `stockOnHand = 1`, `stockReserved = 0` | Disparar 3 checkouts paralelos (`Promise.all`) para 1 unidade dessa variante. | Apenas 1 checkout obtém reserva e cria pedido; os outros 2 recebem `409 OUT_OF_STOCK`; banco nunca fica negativo. | Integração (Concorrência) | `RN23`, `RN24` |
| **CA12** | Informar endereço fora da cobertura | `DeliveryZone` restrita à cidade/bairros aprovados; retirada desativada | Informar CEP fora da área em `/api/delivery/quote` e tentar finalizar em `POST /api/checkout`. | Cotação e checkout retornam `422 OUT_OF_COVERAGE_AREA`; UI impede avanço informando a região atendida. | Integração + E2E | `RN33` |
| **CA13** | Administrador editar pedido | Pedido em estado `PAID` | Admin autenticado avança status para `PREPARING` e depois `OUT_FOR_DELIVERY` via `/admin/pedidos`. | Status atualizado, `OrderStatusHistory` e `AuditLog` gravados com `actorUserId`, timestamp e valores antes/depois. | Integração + E2E | `RN16`, `RN19`, `RN31` |
| **CA14** | Cliente acessar pedido de terceiro | Pedido pertencente ao Cliente A; Cliente B autenticado | Cliente B chama `GET /api/orders/[idDoClienteA]` ou acessa `/conta/pedidos/[idDoClienteA]`. | Servidor retorna `403 FORBIDDEN` (ou tela de acesso negado) sem vazar qualquer dado do pedido. | Integração + E2E | `RN18` |
| **CA15** | Acessar a loja pelo celular | Páginas públicas e fluxo de compra ativos | Executar suíte Playwright em viewport mobile `390×844` (Home, PLP, PDP, Drawer, Checkout). | Zero overflow horizontal, botões com alvo tátil adequado, menu/filtros mobile funcionais e checkout legível. | E2E Mobile | `RNF05`, `RNF06` |

### 2.2. Critérios Adicionais de Produção (`CA16`–`CA24`)

| ID | Cenário de Produção | Pré-condições | Resultado Esperado | Camada | RNs |
| --- | --- | --- | --- | --- | --- |
| **CA16** | Expiração de reserva Pix | Pedido `AWAITING_PAYMENT` com `StockReservation.expiresAt < now()` | Cron `/api/internal/jobs/expire-reservations` muda pedido para `EXPIRED`, libera `stockReserved` e grava `InventoryMovement(RELEASE)`. | Integração | `RN25` |
| **CA17** | Pagamento Pix tardio (*late payment*) | Pedido já `EXPIRED`, variante com estoque `0` (comprado por outro cliente) | Webhook `PAID` tenta re-reservar, falha por falta de estoque, aciona `refundPayment()`, marca `requiresManualReview = true` e gera alerta crítico. | Integração | `RN26` |
| **CA18** | Merge de carrinho visitante → logado | Visitante com 2 itens no carrinho; usuário já tem 1 item igual salvo na conta | Usuário faz login; carrinho final unifica as quantidades limitado ao `availableStock`, invalida o carrinho anônimo e informa eventuais ajustes. | Integração + E2E | `RN30` |
| **CA19** | Idempotência no duplo clique do checkout | Usuário clica 2x rápido no botão "Finalizar" com mesma `Idempotency-Key` | Apenas 1 `Order` e 1 `Payment` são criados; a 2ª chamada retorna o mesmo pedido sem duplicar reserva de estoque. | Integração | `RN28` |
| **CA20** | Auditoria administrativa completa (`AuditLog`) | Admin altera preço de variante, ajusta estoque e muda taxa de entrega | 3 registros imutáveis gravados em `AuditLog` com `beforeState`, `afterState`, `actorUserId` e `entityId`. | Integração | `RN31` |
| **CA21** | Troca de gateway via `PaymentGatewayPort` | Suíte de testes de contrato do adaptador | Alterando `activePaymentProvider` para adaptador mock/secundário, o fluxo de checkout e webhook conclui sem alterar o domínio de `Orders`. | Unitário + Integração | `RNF12` |
| **CA22** | Imutabilidade de histórico após edição/arquivamento | Pedido concluído com item X e endereço Y | Admin altera preço/nome de X ou arquiva X, e cliente apaga endereço Y; detalhe do pedido preserva integralmente os snapshots originais. | Integração | `RN15`, `RN27`, `RN32` |
| **CA23** | Anonimização LGPD sem quebrar histórico fiscal | Cliente possui 2 pedidos concluídos | Fluxo de anonimização remove dados pessoais em `User`/`Address` (`anonymizedAt != null`) mantendo `Order` e totais financeiros íntegros. | Integração | `RN34` |
| **CA24** | Falha do gateway ao criar cobrança no checkout | Gateway retorna timeout ou erro `500` durante `POST /api/checkout` | Transação não deixa estoque preso: reserva é revertida/liberada imediatamente e usuário recebe erro claro para tentar novamente. | Integração | `RN24` |

---

## 3. Matriz de Ambientes e Variáveis de Ambiente (`.env.example`)

### 3.1. Ambientes

| Ambiente | Banco de Dados | Gateway de Pagamentos | Mídia / E-mail | Finalidade |
| --- | --- | --- | --- | --- |
| **Local (`dev`)** | PostgreSQL local (Docker) ou branch Neon `dev` | Modo Sandbox | Pasta `dev/` no Cloudinary; e-mails de teste | Desenvolvimento e testes unitários/integração |
| **Preview / Staging** | Branch isolado Neon/Supabase (`staging`) | Modo Sandbox com webhook HTTPS de Preview | Pasta `staging/` no Cloudinary; e-mail sandbox | Homologação pelo cliente, E2E Playwright e teste de restore |
| **Production (`prod`)** | Banco PostgreSQL dedicado com PITR ativo | Credenciais **Live/Produção** + Webhook Live | Pasta `prod/` no Cloudinary; domínio próprio verificado no Resend | Operação real da loja |

### 3.2. Catálogo `.env.example` (Validado por `src/lib/env.ts`)

> [!CAUTION]
> Variáveis sem prefixo `NEXT_PUBLIC_` **nunca** devem ser expostas ao bundle do navegador nem commitadas em `.env`.

```ini
# ==========================================
# APLICACAO E BANCO DE DADOS
# ==========================================
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
DATABASE_URL="postgresql://user:password@host:5432/loja_roupas?sslmode=require"
DIRECT_URL="postgresql://user:password@host:5432/loja_roupas?sslmode=require"

# ==========================================
# AUTENTICACAO E SEGURANCA INTERNA
# ==========================================
AUTH_SECRET="gerar-segredo-aleatorio-32-bytes-hex"
AUTH_URL="http://localhost:3000"
CRON_SECRET="gerar-segredo-exclusivo-para-cron-vercel"

# ==========================================
# PAGAMENTOS (CAMADA AGNOSTICA)
# ==========================================
# Valores aceitos: mercadopago | pagarme | asaas
PAYMENT_PROVIDER="mercadopago"

# Exemplo Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=""
MERCADOPAGO_WEBHOOK_SECRET=""
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=""

# Exemplo Pagar.me (preencher se escolhido)
PAGARME_SECRET_KEY=""
PAGARME_WEBHOOK_SECRET=""
NEXT_PUBLIC_PAGARME_PUBLIC_KEY=""

# Exemplo Asaas (preencher se escolhido)
ASAAS_API_KEY=""
ASAAS_WEBHOOK_TOKEN=""
ASAAS_ENV="sandbox"

# ==========================================
# MIDIA (CLOUDINARY)
# ==========================================
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
CLOUDINARY_BASE_FOLDER="store/dev"

# ==========================================
# EMAIL TRANSACIONAL (RESEND)
# ==========================================
RESEND_API_KEY=""
RESEND_FROM_EMAIL="pedidos@seudominio.com.br"

# ==========================================
# OBSERVABILIDADE E RATE LIMIT
# ==========================================
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

---

## 4. Pipeline CI/CD e Disciplina de Migrations

### 4.1. Etapas do CI (GitHub Actions em cada Pull Request)
1. **Qualidade Estática:** `npm ci`, `npm run lint`, `npm run typecheck` (`tsc --noEmit`) e `npx prisma validate`.
2. **Testes Unitários:** `npm run test:unit` (Vitest).
3. **Testes de Integração e Concorrência:** sobe serviço `postgres:16` no runner, aplica `npx prisma migrate deploy` e executa `npm run test:integration` (incluindo `CA07`, `CA10`, `CA11`, `CA14`).
4. **Build de Verificação:** `npm run build` garantindo zero erros de compilação Next.js.
5. **E2E em Preview (`main` / PRs críticos):** executa Playwright contra a URL de Preview da Vercel com banco de staging populado via `seed`.

### 4.2. Disciplina de Deploy em Produção (Zero Downtime)
- Executar `npx prisma migrate deploy` antes/durante o rollout usando apenas mudanças aditivas compatíveis com a versão anterior enquanto instâncias antigas ainda possam estar servindo.
- Evitar remover ou renomear colunas diretamente em um único deploy; quando necessário, fazer em duas etapas (*expand-and-contract*).
- Rotinas agendadas configuradas no `vercel.json`:
  - `/api/internal/jobs/expire-reservations`: a cada **1 minuto** (ou 2 minutos) autenticado por `Authorization: Bearer $CRON_SECRET`.

---

## 5. Observabilidade, Alertas e Healthcheck

1. **Logging Estruturado (JSON):** cada requisição gera `requestId` e registra `route`, `method`, `statusCode`, `durationMs`, `userId` (se houver), `orderId` e `provider`. **Proibido** logar senhas, tokens, headers de autorização ou dados sensíveis de pagamento.
2. **Sentry:** captura automática de exceções não tratadas no App Router e APIs com upload de source maps no build.
3. **Endpoint de Saúde (`GET /api/health`):** verifica conexão com PostgreSQL (`SELECT 1`), retorna versão/commit do build e status `200 OK` (ou `503` se banco indisponível) para monitoramento externo (UptimeRobot / Better Stack).
4. **Alertas Operacionais Críticos (e-mail/Slack/WhatsApp técnico imediato):**
   - Qualquer falha de assinatura em webhook (`signatureValid = false`) acima de 3 ocorrências em 5 minutos.
   - Taxa de erro `5xx` em `/api/checkout` ou `/api/webhooks/payments/*` > 1%.
   - Existência de `Order` com `requiresManualReview = true` (ex.: *late payment* sem estoque para estorno/auditoria).
   - Reservas `StockReservation(ACTIVE)` com `expiresAt` vencido há mais de 5 minutos (sinal de falha no cron).

---

## 6. Estratégia de Backup, PITR e Teste de Restore

Atendendo diretamente ao critério de qualidade da v1.0 (**"Backup e recuperação de dados testados"**):

- **Política de Backup (Neon / Supabase):**
  - Snapshots automatizados diários retidos por no mínimo 30 dias.
  - **Point-in-Time Recovery (PITR)** habilitado em produção (RPO alvo ≤ 5 minutos, RTO alvo ≤ 2 horas).
  - Exportação lógica complementar semanal criptografada fora do provedor principal (opcional recomendada antes de grandes campanhas).
- **Procedimento Obrigatório de Teste de Restore (Pré-Go-Live e Trimestral):**
  1. Criar um branch/instância temporária isolada a partir do último snapshot ou timestamp PITR de produção/staging.
  2. Executar query de integridade verificando contagem de registros (`User`, `Product`, `ProductVariant`, `Order`, `InventoryMovement`) e consistência das constraints `CHECK` de estoque.
  3. Apontar ambiente de staging temporário para o banco restaurado, fazer login como cliente e como Admin e validar visualização de catálogo e pedidos históricos.
  4. Registrar data, responsável, tempo total de restauração (RTO medido) e resultado no log operacional, destruindo o banco temporário após a validação.

---

## 7. Checklist de Go-Live (Produção)

### Pré-Lançamento (`T - 7 dias`)
- [ ] [01-APROVACAO-COMERCIAL-CLIENTE.md](./01-APROVACAO-COMERCIAL-CLIENTE.md) 100% preenchido e assinado (identidade legal + 12 decisões).
- [ ] Domínio configurado com SSL ativo na Vercel; registros DNS SPF/DKIM verificados no Resend.
- [ ] Conta PJ do gateway homologada e credenciais **Live** configuradas com segurança.
- [ ] Webhook cadastrado no painel do gateway apontando para `https://<dominio>/api/webhooks/payments/<provider>` com segredo HMAC validado.
- [ ] `StoreConfig`, `DeliveryZone` e todas as `StorePolicy` (Trocas, Devoluções 7 dias CDC, Privacidade, Termos) cadastradas e revisadas no painel Admin.
- [ ] Suíte `CA01`–`CA24` 100% aprovada em staging e **Teste de Restore** documentado com sucesso.

### Dia do Lançamento (`T - 0`)
- [ ] Aplicar `prisma migrate deploy` no banco de produção e confirmar `/api/health` retornando `200 OK`.
- [ ] Validar execução do Cron `/api/internal/jobs/expire-reservations`.
- [ ] Cadastrar ao menos um produto real de teste e executar **compra real em produção de R$ 1,00 via Pix** (e verificação de cartão) validando: criação do pedido, recebimento do webhook, baixa real do estoque, disparo do e-mail transacional e **estorno completo em seguida**.
- [ ] Ativar catálogo real e remover banners/produtos de teste.

### Pós-Lançamento (`Primeiras 72h`)
- [ ] Monitorar Sentry, logs de webhooks e fila de `StockReservation` a cada 4–6 horas.
- [ ] Validar com o lojista o recebimento e avanço de status dos primeiros pedidos reais no `/admin/pedidos`.

---

## 8. Runbooks de Incidentes em Produção

### Runbook 1 — Webhook de Pagamento Parou ou Retorna Erro `5xx`
1. Verificar logs filtrando por `/api/webhooks/payments` e Sentry para identificar erro de assinatura, timeout do gateway ou falha de banco.
2. Conferir o painel oficial do gateway para listar transações pagas recentemente que ainda apareçam como `AWAITING_PAYMENT` no Admin.
3. Após corrigir a causa raiz (ex.: segredo HMAC desatualizado ou deploy de fix), usar a função do painel do gateway para reenviar webhooks com falha ou executar reconciliação S2S via `getPaymentStatus(externalPaymentId)` — a tabela `WebhookEvent` garante idempotência para eventos já processados.

### Runbook 2 — Pagamento Pix Tardio (`requiresManualReview = true`)
1. Abrir `/admin/pedidos` filtrado por `Revisão Manual`.
2. Verificar se o estorno automático pelo adaptador foi concluído no `Payment.status = REFUNDED`.
3. Se o estorno automático falhou (erro transitório do gateway), acionar estorno manual no painel do gateway/Admin, atualizar o pedido para `REFUNDED` e contatar o cliente via e-mail/WhatsApp de suporte explicando a expiração da reserva.

### Runbook 3 — Divergência Suspeita de Estoque
1. Nunca alterar `stockOnHand` diretamente por SQL manual sem registro.
2. Consultar a linha do tempo completa da variante em `InventoryMovement` (ordenado por `createdAt`) cruzando `quantityDelta`, `reservedDelta` e `StockReservation` ativos.
3. Caso haja divergência física real (ex.: peça danificada no estoque da loja), registrar ajuste oficial via `/admin/estoque` com motivo explícito para manter `InventoryMovement` e `AuditLog` consistentes.

### Runbook 4 — Rollback de Deploy com Problema
1. **Se o erro for apenas de código/UI (sem migration destrutiva):** realizar *Instant Rollback* na Vercel para o deployment estável anterior em menos de 1 minuto.
2. **Se envolver banco de dados:** como as migrations seguem disciplina aditiva (*expand-and-contract*), o código anterior continuará compatível enquanto a correção é preparada; **nunca** rodar `prisma migrate reset` nem `DROP` em produção. Em corrupção severa de dados, acionar procedimento de PITR para o minuto imediatamente anterior ao incidente.
