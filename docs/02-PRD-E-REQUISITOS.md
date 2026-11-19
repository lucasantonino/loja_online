# 02 — PRD e Especificação Consolidada de Requisitos

Este Documento de Requisitos do Produto (PRD) consolida os objetivos de negócio, perfis de usuário, escopo dos 6 módulos funcionais, regras de negócio (`RN01`–`RN34`), requisitos não-funcionais (`RNF01`–`RNF14`) e a matriz de rastreabilidade integral para desenvolvimento e testes.

---

## 1. Visão Geral e Limites de Escopo

### 1.1. Objetivo do Produto
Disponibilizar uma loja virtual B2C própria para venda de **roupas e acessórios**, otimizada para dispositivos móveis, com seleção precisa de variações (cor, tamanho e opções dinâmicas), pagamento via **Pix e cartão**, **entrega local** controlada por cobertura e um **painel administrativo** para operação autônoma de catálogo, estoque e pedidos.

### 1.2. Classificação de Escopo

| Categoria | Itens Incluídos |
| --- | --- |
| **MVP Obrigatório (`P0`, `T01`–`T15`)** | Vitrine e catálogo responsivo; busca e filtros essenciais; produtos simples e variáveis; controle atômico e reserva temporária de estoque; autenticação e conta do cliente; carrinho (visitante + merge); validação de entrega local / retirada; checkout server-side; Pix e cartão via adaptador; webhooks idempotentes; gestão de pedidos e configurações no painel Admin. |
| **Pós-MVP Imediato (`P1`, `T16`–`T18`)** | Pacote completo de e-mails transacionais, indicadores financeiros e operacionais no dashboard administrativo e filtros avançados combináveis com contadores. |
| **Evolução Futura (`P2`, `T19`–`T20`)** | Cupons promocionais, produtos relacionados avançados, lista de favoritos e avaliações de clientes verificados. |
| **Fora de Escopo (Não Construir no MVP)** | Integração bidirecional com ERP externo, emissão automática de NF-e, marketplace multi-lojista, cálculo de frete nacional (Correios/transportadoras interestaduais), aplicativo nativo iOS/Android e PDV físico em loja. |

---

## 2. Personas e Matriz de Permissões (RBAC)

O sistema reconhece três níveis de interação, mapeados aos papéis `CUSTOMER` e `ADMIN` no modelo `User`:

| Capacidade | Visitante (Não Autenticado) | Cliente (`CUSTOMER`) | Administrador (`ADMIN`) |
| --- | :---: | :---: | :---: |
| Navegar no catálogo, buscar, filtrar e ver variações | Sim | Sim | Sim |
| Simular entrega local por CEP/bairro | Sim | Sim | Sim |
| Adicionar/editar itens no carrinho (sessão anônima) | Sim | Sim | Sim |
| Criar conta, fazer login e redefinir senha | Sim | Sim | Sim |
| Salvar e gerenciar múltiplos endereços | Não | Sim | Sim |
| Finalizar compra (checkout) | Não (redireciona para login/cadastro rápido com preservação do carrinho) | Sim | Sim |
| Consultar apenas os próprios pedidos (`CA14`) | Não | Sim | Todos |
| Cancelar pedido ainda em `AWAITING_PAYMENT` | Não | Apenas próprio | Qualquer elegível |
| Gerenciar categorias, produtos, imagens e variantes | Não | Não | Sim |
| Ajustar estoque e visualizar histórico de movimentações | Não | Não | Sim |
| Alterar status operacional de pedidos (`CA13`) | Não | Não | Sim |
| Configurar zonas de entrega, políticas e `StoreConfig` | Não | Não | Sim |
| Consultar `AuditLog` e métricas administrativas | Não | Não | Sim |

---

## 3. Requisitos Funcionais por Módulo (`RF01`–`RF42`)

### Módulo 1 — Loja Virtual (Interface Pública e Catálogo)
- **RF01:** Exibir página inicial com seções configuráveis (destaques, lançamentos, categorias principais e informações institucionais obrigatórias).
- **RF02:** Exibir menu de navegação responsivo com árvore de categorias e subcategorias ativas.
- **RF03:** Listar produtos publicados (`status = ACTIVE` e `deletedAt = null`) em grade paginada (PLP) com imagem principal, nome, preço e indicador de disponibilidade/cores.
- **RF04:** Permitir busca textual por nome/descrição e SKU no catálogo público.
- **RF05:** Permitir filtragem por **categoria**, **tamanho**, **cor**, **faixa de preço** e **somente disponíveis em estoque**, além de ordenação por **menor preço**, **maior preço** e **mais recentes**.
- **RF06:** Exibir Página Individual do Produto (PDP) com galeria de imagens, descrição, tabela/guia de medidas, preço, simulador rápido de entrega local e seletor de variações.
- **RF07:** Exibir páginas públicas de políticas comerciais (`StorePolicy`: trocas, devoluções, privacidade, termos e entrega) e dados obrigatórios do Decreto nº 7.962/2013.

### Módulo 2 — Produtos e Variações
- **RF08:** Suportar **Produto Simples** (`hasVariants = false`), criando automaticamente 1 variante padrão oculta (`isDefault = true`) para unificar estoque, carrinho e pedidos.
- **RF09:** Suportar **Produto Variável** (`hasVariants = true`) com opções dinâmicas (`ProductOption`, ex.: Cor, Tamanho, Modelo) e valores ordenáveis (`ProductOptionValue`, com `colorHex` opcional para swatches).
- **RF10:** Controlar estoque, preço opcional por variação e **SKU único obrigatório** em cada `ProductVariant` (combinação única garantida por `optionCombinationKey`).
- **RF11:** Na PDP, ao selecionar uma opção (ex.: cor `Branca`), atualizar em tempo real quais combinações restantes têm estoque disponível (`stockOnHand - stockReserved > 0`). Exemplo clássico da v1.0: na Camiseta Básica (Preta/Branca × P/M/G), com `Branca + M = 0`, a combinação `Branca + M` aparece indisponível sem bloquear `Branca + P`, `Branca + G` ou `Preta + M` (`CA04`, `CA05`).
- **RF12:** Associar múltiplas imagens ao produto (`ProductImage`), respeitando o limite configurável `StoreConfig.maxImagesPerProduct` e permitindo opcionalmente vincular fotos a um valor de opção (ex.: cor).

### Módulo 3 — Usuários, Autenticação e Permissões
- **RF13:** Permitir cadastro de cliente com nome, e-mail único, senha forte e aceite explícito dos Termos e Política de Privacidade.
- **RF14:** Permitir login com e-mail e senha, manutenção segura de sessão (`HttpOnly`, `Secure`, `SameSite=Lax`) e logout.
- **RF15:** Disponibilizar fluxo de recuperação de senha com token temporário de uso único armazenado em hash e enviado por e-mail.
- **RF16:** Permitir ao cliente gerenciar múltiplos endereços de entrega (`Address`), marcando um como principal.
- **RF17:** Bloquear qualquer acesso a rotas `/admin/*` ou `/api/admin/*` para usuários sem papel `ADMIN`, e validar propriedade (`userId`) em todas as consultas e ações sobre endereços, carrinho e pedidos do cliente (`CA14`).
- **RF18:** Disponibilizar mecanismo de solicitação de exportação de dados ou exclusão/anonimização de conta pelo titular em conformidade com a LGPD.

### Módulo 4 — Carrinho
- **RF19:** Permitir que visitantes adicionem variantes válidas ao carrinho antes do login, vinculados a um token de sessão em cookie `HttpOnly` com expiração (TTL configurável de 30 dias).
- **RF20:** Ao fazer login ou cadastro, executar automaticamente o **merge determinístico** do carrinho visitante para o carrinho do usuário autenticado, respeitando o estoque disponível.
- **RF21:** Bloquear adição ou aumento de quantidade quando o produto/variante estiver inativo, sem todas as opções selecionadas ou com quantidade solicitada maior que `stockOnHand - stockReserved` (`CA05`).
- **RF22:** Permitir alterar quantidade e remover itens do carrinho, recalculando subtotais exclusivamente no servidor (`CA06`).
- **RF23:** Detectar e sinalizar claramente ao cliente qualquer mudança de preço ou redução de estoque ocorrida desde a adição ao carrinho antes da confirmação do checkout (`RN13`).

### Módulo 5 — Pedidos, Checkout, Pagamentos e Entrega Local
- **RF24:** Permitir informar CEP/endereço (ou escolher endereço salvo) e verificar elegibilidade nas zonas configuradas (`DeliveryZone`), apresentando taxa de entrega, regra de frete grátis (se houver) e prazo estimado; bloquear finalização para endereços fora da cobertura (`CA12`).
- **RF25:** Exibir a modalidade **Retirada no Estabelecimento** (`STORE_PICKUP`) somente quando `StoreConfig.storePickupEnabled = true`.
- **RF26:** No checkout, validar pedido mínimo (`StoreConfig.minOrderCents`), recalcular todos os preços e taxa de entrega no servidor, ignorando qualquer valor enviado pelo cliente (`CA07`), e exigir cabeçalho `Idempotency-Key`.
- **RF27:** Ao confirmar o pedido, criar `Order` em estado `AWAITING_PAYMENT` com snapshots imutáveis dos itens (`OrderItem`) e do endereço (`shippingAddressSnapshot`), e criar reservas atômicas (`StockReservation`) por `pixReservationMinutes` ou `cardReservationMinutes`.
- **RF28:** Integrar pagamentos via `PaymentGatewayPort` suportando **Pix** (QR Code + Copia e Cola + validade sincronizada com a reserva) e **Cartão** (tokenizado no frontend, sem trafegar PAN/CVV pelo servidor da loja — PCI SAQ-A) (`CA08`, `CA09`).
- **RF29:** Processar webhooks de pagamento verificando assinatura criptográfica, deduplicando eventos por `WebhookEvent(provider, externalEventId)` (`CA10`), confirmando o status diretamente na API do gateway e, após aprovação, baixando definitivamente `stockOnHand` e `stockReserved` com registro de `InventoryMovement (SALE)`.
- **RF30:** Executar rotina periódica (cron) para expirar pedidos com reserva vencida e pagamento não confirmado, liberando `stockReserved` e registrando `InventoryMovement (RELEASE)`.
- **RF31:** Tratar explicitamente **pagamento Pix tardio** (recebido após expiração da reserva): tentar nova reserva atômica se ainda houver saldo; caso não haja estoque, manter o pedido bloqueado/sinalizado (`requiresManualReview = true`) e acionar estorno automático + alerta ao Admin.
- **RF32:** Permitir que o cliente consulte sua lista de pedidos e o detalhe completo (itens, resumo de variações, endereço, status atual, timeline e código Pix se ainda válido), além de cancelar pedidos próprios enquanto em `AWAITING_PAYMENT`.

### Módulo 6 — Administração (Painel do Lojista)
- **RF33:** Gerenciar categorias e subcategorias (nome, slug, imagem, ordem, ativação).
- **RF34:** Cadastrar, editar, ativar/inativar e arquivar (soft delete) produtos simples e variáveis, suas opções, matriz de combinações de variantes, SKUs, preços e imagens no Cloudinary (`CA01`, `CA02`).
- **RF35:** Executar ajustes manuais de entrada e saída de estoque por variante com campo obrigatório de motivo (`reason`), gravando `InventoryMovement` e bloqueando qualquer operação que resulte em saldo disponível negativo.
- **RF36:** Visualizar pedidos por status, data ou número, inspecionar detalhes completos, atualizar status operacionais permitidos (`PAID → PREPARING → OUT_FOR_DELIVERY / READY_FOR_PICKUP → DELIVERED`) e registrar cancelamento/estorno com registro em `OrderStatusHistory` (`CA13`).
- **RF37:** Gerenciar zonas de entrega local (`DeliveryZone`: cidade, tipo de match por faixa de CEP/bairro/cidade, taxa, frete grátis opcional, prazo e ativação).
- **RF38:** Editar configurações globais (`StoreConfig`) e políticas legais (`StorePolicy`) diretamente pelo painel, sem alteração de código.
- **RF39:** Registrar automaticamente todas as mutações administrativas relevantes em `AuditLog` imutável (ator, ação, entidade, antes/depois, IP, timestamp).
- **RF40 (`P1`):** Exibir dashboard com indicadores de vendas (faturamento confirmado, quantidade de pedidos, ticket médio, pedidos pendentes de envio e lista de variantes abaixo do estoque mínimo).
- **RF41 (`P2`):** Gerenciar cupons promocionais (código, desconto percentual/fixo, validade, limite de uso).
- **RF42 (`P2`):** Moderar avaliações de clientes verificados e disponibilizar favoritos na loja.

---

## 4. Regras de Negócio Consolidadas (`RN01`–`RN34`)

### 4.1. Regras Originais Preservadas (`RN01`–`RN19`)

| ID | Domínio | Regra |
| --- | --- | --- |
| **RN01** | Produto | Todo produto deve possuir nome, preço e categoria. |
| **RN02** | Produto | Todo produto deve possuir identificação única (`id` e `slug` único). |
| **RN03** | Produto | Produtos simples devem controlar seu próprio estoque (via sua variante padrão `isDefault = true`). |
| **RN04** | Produto | Produtos variáveis devem controlar estoque por combinação de variações. |
| **RN05** | Produto | Uma combinação de variações (e também a variante padrão) deve possuir SKU próprio único. |
| **RN06** | Produto | Produtos inativos (`status != ACTIVE` ou `deletedAt != null`) não devem aparecer na loja pública nem ser comprados. |
| **RN07** | Produto | Produtos/variantes sem estoque disponível (`stockOnHand - stockReserved <= 0`) não podem ser comprados. |
| **RN08** | Produto | O preço deve ser validado no servidor; valores enviados pelo cliente são sempre ignorados. |
| **RN09** | Carrinho | O carrinho deve armazenar os produtos/variantes selecionados. |
| **RN10** | Carrinho | Produtos variáveis exigem seleção de todas as opções obrigatórias antes da inclusão no carrinho. |
| **RN11** | Carrinho | A quantidade no carrinho e no checkout não pode ultrapassar o estoque disponível (`stockOnHand - stockReserved`). |
| **RN12** | Carrinho | O sistema deve recalcular subtotais, taxas e total no servidor. |
| **RN13** | Carrinho | Alterações de preço ocorridas após a adição ao carrinho devem ser refletidas e informadas antes da confirmação do pedido. |
| **RN14** | Pedido | Todo pedido deve possuir identificador único (`id` interno e `orderNumber` legível). |
| **RN15** | Pedido | O pedido deve registrar os dados dos produtos (nome, SKU, variação, imagem e preço unitário) no momento da compra. |
| **RN16** | Pedido | O pedido deve possuir um status controlado por máquina de estados válida. |
| **RN17** | Pedido | O pedido só poderá ser confirmado (`PAID`) após validação do pagamento no servidor/gateway (ou confirmação operacional excepcional se `payOnDeliveryEnabled` estiver ativo). |
| **RN18** | Pedido | O cliente deverá consultar apenas os seus próprios pedidos. |
| **RN19** | Pedido | O administrador poderá atualizar os status operacionais permitidos, mantendo trilha de auditoria. |

### 4.2. Regras de Produção Adicionadas (`RN20`–`RN34`)

| ID | Domínio | Regra |
| --- | --- | --- |
| **RN20** | Variantes | Estratégia *Default Variant*: todo produto possui ao menos 1 `ProductVariant`; produtos simples possuem exatamente 1 variante com `isDefault = true` e `optionCombinationKey = "DEFAULT"`. |
| **RN21** | Variantes | Combinações de opções em um mesmo produto são únicas via chave canônica ordenada `optionCombinationKey` (`@@unique([productId, optionCombinationKey])`). |
| **RN22** | Financeiro | Todos os valores monetários são armazenados e calculados em **centavos inteiros (`Int`, BRL)**, proibindo aritmética em ponto flutuante. |
| **RN23** | Estoque | O estoque disponível para venda é `stockOnHand - stockReserved`, protegido por constraints SQL `CHECK (stock_on_hand >= 0)`, `CHECK (stock_reserved >= 0)` e `CHECK (stock_reserved <= stock_on_hand)`. |
| **RN24** | Estoque | Ao criar pedido com pagamento online, toda quantidade gera `StockReservation (ACTIVE)` atômica com `expiresAt` baseado em `StoreConfig.pixReservationMinutes` ou `cardReservationMinutes`; compras concorrentes pelo último item devem falhar atomicamente para o segundo comprador (`CA11`). |
| **RN25** | Estoque | Ao expirar o prazo da reserva sem pagamento aprovado, o sistema expira pedido e reserva, decrementa `stockReserved` e grava `InventoryMovement (RELEASE)`. |
| **RN26** | Pagamento | Em caso de pagamento Pix tardio após expiração da reserva, tenta-se nova reserva atômica; se indisponível, o sistema aciona estorno automático no gateway e marca `Order.requiresManualReview = true` com alerta operacional. |
| **RN27** | Pedido | O endereço de entrega do pedido é persistido como snapshot JSON imutável (`Order.shippingAddressSnapshot`) além da referência opcional `shippingAddressId`, protegendo o histórico contra edições/exclusões futuras em `Address`. |
| **RN28** | Idempotência | Toda chamada a `POST /api/checkout` exige cabeçalho `Idempotency-Key` único por tentativa de compra, retornando o mesmo pedido/pagamento em retentativas de rede ou duplo clique. |
| **RN29** | Webhooks | Todo webhook deve validar assinatura HMAC do provedor, gravar idempotência em `WebhookEvent(provider, externalEventId)` e reconsultar o status da transação na API do gateway antes de alterar o pedido (`CA10`). |
| **RN30** | Carrinho | No login/cadastro, itens do carrinho visitante são mesclados ao carrinho autenticado somando quantidades por `variantId`, limitados ao estoque disponível atual. |
| **RN31** | Auditoria | Toda ação administrativa de criação, edição, exclusão/arquivamento, ajuste de estoque, mudança de pedido ou configuração deve gerar registro em `AuditLog` e (quando aplicável) `OrderStatusHistory`. |
| **RN32** | Ciclo de vida | Produtos e variantes já referenciados em `OrderItem` nunca sofrem deleção física (`DELETE`); utilizam arquivamento (`status = ARCHIVED`, `deletedAt != null`). |
| **RN33** | Configuração | Nenhuma regra comercial variável (cidade, bairros, taxa, prazo, pedido mínimo, retirada, pagamento na entrega, tempos de reserva, políticas, limite de imagens) pode ser hardcoded no código; deve ser lida de `StoreConfig`, `DeliveryZone` e `StorePolicy`. |
| **RN34** | Legal (BR) | Conformidade obrigatória com Decreto nº 7.962/2013 (exibição de CNPJ, razão social, endereço, SAC e resumo claro antes da compra), CDC Art. 49 (arrependimento em 7 dias) e LGPD (base legal, TTL de carrinhos anônimos e anonimização segura preservando histórico fiscal). |

---

## 5. Requisitos Não-Funcionais (`RNF01`–`RNF14`)

| ID | Categoria | Requisito Objetivo |
| --- | --- | --- |
| **RNF01** | Desempenho Web | Core Web Vitals em produção (4G móvel): LCP ≤ 2,5s, INP ≤ 200ms, CLS ≤ 0,10 em páginas públicas principais. |
| **RNF02** | Latência de API | Endpoints de catálogo/busca P95 ≤ 300ms com cache; endpoints transacionais (checkout/estoque) P95 ≤ 800ms excluindo latência do gateway externo. |
| **RNF03** | Escalabilidade | Suportar catálogo inicial de 50–500 produtos com folga arquitetural para 5.000+ SKUs sem degradação das consultas filtradas. |
| **RNF04** | Disponibilidade | Meta de disponibilidade ≥ 99,5% para vitrine e checkout; falha do serviço de e-mail nunca pode bloquear confirmação de pedido/webhook. |
| **RNF05** | Responsividade | Layout mobile-first validado em larguras de 360px a 1440px+ sem overflow horizontal (`CA15`). |
| **RNF06** | Acessibilidade | Conformidade com WCAG 2.2 Nível AA: contraste adequado, foco visível, navegação completa por teclado em seletores de variação e alvos de toque ≥ 44×44px. |
| **RNF07** | Segurança | HTTPS obrigatório, cookies `HttpOnly/Secure/SameSite`, senhas com Argon2id/bcrypt, proteção OWASP Top 10, rate limiting em rotas sensíveis e PCI SAQ-A via tokenização no frontend do gateway. |
| **RNF08** | Privacidade (LGPD) | Nunca registrar senhas, tokens, CPF completo ou payloads brutos com dados de cartão em logs; carrinhos anônimos expirados removidos automaticamente após 30 dias. |
| **RNF09** | Observabilidade | Logs estruturados em JSON com `requestId`, rastreamento de erros via Sentry e endpoint `/api/health` verificando conectividade com PostgreSQL. |
| **RNF10** | Backup & Recovery | Backup diário automatizado + Point-in-Time Recovery (PITR) no PostgreSQL com RPO ≤ 5 minutos, RTO ≤ 2 horas e teste de restore obrigatório antes do Go-Live. |
| **RNF11** | Manutenibilidade | Monólito modular com TypeScript `strict: true`, contratos Zod compartilhados e cobertura automatizada dos fluxos críticos financeiros/estoque. |
| **RNF12** | Portabilidade | Pagamentos isolados atrás da interface `PaymentGatewayPort`, permitindo troca de provedor sem alterar regras de pedido ou UI de checkout. |
| **RNF13** | SEO | URLs amigáveis (`/categoria/[slug]`, `/produto/[slug]`), meta tags dinâmicas, OpenGraph, JSON-LD `Product` e `sitemap.xml` automático. |
| **RNF14** | Auditabilidade | Trilhas imutáveis em `InventoryMovement`, `OrderStatusHistory`, `WebhookEvent` e `AuditLog` com carimbo temporal UTC. |

---

## 6. Matriz de Rastreabilidade (`Módulo × RF × RN × CA × Backlog`)

| Módulo | Requisitos (`RF`) | Regras (`RN`) | Critérios de Aceite (`CA`) | Backlog (`T`) |
| --- | --- | --- | --- | --- |
| **Loja Virtual** | `RF01`–`RF07` | `RN06`, `RN07`, `RN08`, `RN33`, `RN34` | `CA03`, `CA15` | `T02`, `T07`, `T18`, `T20` |
| **Produtos & Variações** | `RF08`–`RF12` | `RN01`–`RN08`, `RN20`, `RN21`, `RN32` | `CA01`, `CA02`, `CA04`, `CA05`, `CA22` | `T04`, `T05`, `T06` |
| **Usuários & Segurança** | `RF13`–`RF18` | `RN18`, `RN31`, `RN34` | `CA14`, `CA23` | `T08` |
| **Carrinho** | `RF19`–`RF23` | `RN09`–`RN13`, `RN22`, `RN30` | `CA05`, `CA06`, `CA07`, `CA18` | `T09` |
| **Pedidos, Checkout, Pagamento & Entrega** | `RF24`–`RF32` | `RN14`–`RN17`, `RN22`–`RN29`, `RN33`, `RN34` | `CA07`–`CA12`, `CA16`, `CA17`, `CA19`, `CA21`, `CA22`, `CA24` | `T01`, `T10`, `T11`, `T12`, `T13`, `T16`, `T19` |
| **Administração & Estoque** | `RF33`–`RF42` | `RN01`–`RN06`, `RN19`, `RN23`, `RN31`–`RN33` | `CA01`, `CA02`, `CA11`, `CA13`, `CA20` | `T06`, `T14`, `T15`, `T17` |
