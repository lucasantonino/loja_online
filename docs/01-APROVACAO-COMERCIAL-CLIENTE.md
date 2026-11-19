# 01 — Caderno de Aprovação Comercial do Cliente (`T01`)

> **Objetivo:** Formalizar com o(a) lojista todas as definições comerciais, operacionais, visuais e legais que estavam pendentes na Especificação Técnica Inicial v1.0.  
> **Regra de Ouro:** A equipe técnica **não inventa** regras comerciais. Todos os parâmetros abaixo são projetados como campos editáveis no painel administrativo (`StoreConfig`, `DeliveryZone` e `StorePolicy`), mas precisam de validação formal antes do lançamento em produção (Go-Live).

---

## Como Usar Este Documento

1. Preencha os campos de decisão na reunião de alinhamento com o(a) proprietário(a) da loja.
2. Caso algum item fique com decisão provisória para ambiente de homologação, marque como **Provisório** e defina a data limite antes do Go-Live (recomendado: antes de concluir `T10` e `T12`).
3. Após preenchido e assinado no **Bloco D**, os valores aprovados alimentam diretamente o `prisma/seed.ts` inicial e o painel `/admin/configuracoes`.

---

## Bloco A — Identidade da Marca, Domínio e Dados Obrigatórios (Decreto nº 7.962/2013)

No Brasil, o Decreto do E-commerce (Decreto nº 7.962/2013) exige que toda loja virtual exiba em local visível e de fácil acesso (geralmente no rodapé e na página de contato/políticas) os dados de identificação do fornecedor e canais de atendimento.

| Item | Descrição / Finalidade | Campo no Sistema | Resposta / Definição do Cliente |
| --- | --- | --- | --- |
| **A01 — Nome Fantasia da Loja** | Nome comercial exibido no cabeçalho, SEO e e-mails | `StoreConfig.storeName` | `[ Preencher ]` |
| **A02 — Razão Social** | Nome empresarial registrado para rodapé e termos | `StoreConfig.legalName` | `[ Preencher ]` |
| **A03 — CNPJ (ou CPF se aplicável)** | Obrigatório pelo Decreto 7.962/2013 e para conta PJ de gateway | `StoreConfig.cnpj` | `[ Preencher ]` |
| **A04 — Endereço Físico Comercial** | Obrigatório no rodapé (Decreto 7.962/2013) e referência para retirada | `StoreConfig.physicalAddress` | `[ Preencher ]` |
| **A05 — E-mail Oficial de Atendimento (SAC)** | Canal formal de dúvidas, trocas, devoluções e LGPD | `StoreConfig.supportEmail` | `[ Preencher ]` |
| **A06 — WhatsApp / Telefone de Suporte** | Canal ágil de atendimento ao cliente | `StoreConfig.supportWhatsapp` | `[ Preencher ]` |
| **A07 — Horário de Atendimento** | Janela de resposta informada na loja e nos e-mails | `StoreConfig.serviceHours` | `[ Preencher ]` |
| **A08 — Domínio Principal Desejado** | Endereço web da loja (ex.: `www.suamarca.com.br`) | Infraestrutura / DNS | `[ Preencher ]` |
| **A09 — E-mail Remetente Transacional** | Ex.: `pedidos@suamarca.com.br` (verificado no Resend via DKIM/SPF) | `RESEND_FROM_EMAIL` | `[ Preencher ]` |
| **A10 — Direcionamento Visual (`T02`)** | Público-alvo (feminino/masculino/unissex), estilo da marca (minimalista, urbano, sofisticado), cores desejadas e 2–3 referências de sites | Briefing para `T02` (Figma) | `[ Preencher ]` |

---

## Bloco B — As 12 Decisões Comerciais Pendentes (Seção 8 da v1.0)

Cada decisão abaixo preserva integralmente os itens listados na Seção 8 da v1.0, detalhando impacto técnico, opções de mercado e mapeamento para a modelagem de banco em [04-MODELAGEM-DADOS-E-PRISMA.md](./04-MODELAGEM-DADOS-E-PRISMA.md).

---

### Decisão 01 — Cidade atendida
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Define a cidade (e UF) elegível para entrega local (`DeliveryZone.city` e `DeliveryZone.state`) e orienta a mensagem de cobertura na home, PDP e checkout (`CA12`).
- **Opções e recomendação:** Definir uma cidade principal única no MVP (e, se houver cidades limítrofes na mesma operação logística, listá-las como zonas extras).
- **Campo configurável:** `StoreConfig.primaryCity`, `StoreConfig.primaryState` e `DeliveryZone.city` / `DeliveryZone.state`.
- **Decisão do cliente:**
  - Cidade / UF principal: `[ _________________________________ ]`
  - Cidades vizinhas atendidas (se houver): `[ _________________________________ ]`

---

### Decisão 02 — Bairros de cobertura
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Permite validar no checkout (`CA12`) se o endereço está dentro da área atendida. Faixas de CEP são mais precisas do que nome digitado de bairro (evita erros de acentuação/abreviação), mas listas de bairros normalizados também são suportadas.
- **Opções e recomendação:**
  - **Opção A (Recomendada):** Cadastrar zonas por **faixa de CEP** (`CEP_RANGE`) com fallback de lista normalizada de bairros (`NEIGHBORHOOD`) ou taxa única municipal (`CITY_FLAT`).
  - **Opção B:** Atender toda a cidade com exceção explícita de bairros rurais/restritos.
- **Campo configurável:** `DeliveryZone.matchType` (`CEP_RANGE | NEIGHBORHOOD | CITY_FLAT`), `DeliveryZone.cepStart`, `DeliveryZone.cepEnd`, `DeliveryZone.neighborhoods`.
- **Decisão do cliente:**
  - `[ ]` Toda a cidade (`CITY_FLAT`)
  - `[ ]` Lista específica de bairros e/ou faixas de CEP (anexar relação): `[ _________________________________ ]`

---

### Decisão 03 — Taxa de entrega
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Impacta diretamente o cálculo do total do pedido no servidor (`RN12`) e a taxa de conversão no carrinho/checkout.
- **Opções e recomendação:**
  - **Opção A:** Taxa fixa única para toda a cidade (ex.: `R$ 10,00` ou `R$ 15,00`).
  - **Opção B (Recomendada para cidades médias/grandes):** Taxa diferenciada por zona/bairro (ex.: Centro vs bairros afastados) + regra opcional de **frete grátis acima de valor mínimo** (`freeShippingMinCents`).
- **Campo configurável:** `DeliveryZone.feeCents` e `DeliveryZone.freeShippingMinCents`.
- **Decisão do cliente:**
  - Modelo escolhido: `[ ]` Taxa fixa única  `[ ]` Taxa por zona/bairro
  - Valor(es) aprovado(s): `[ _________________________________ ]`
  - Frete grátis acima de (deixar em branco se não houver): `[ _________________ ]`

---

### Decisão 04 — Prazo de entrega
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Exibido na simulação de frete, no checkout (`RF24` / `RN33`) e nos e-mails de confirmação. Precisa refletir a capacidade real de separação + motoboy/entregador para evitar reclamações.
- **Opções e recomendação:**
  - **Opção A:** Mesmo dia para pedidos aprovados até determinado horário de corte (ex.: até 14h); após esse horário, próximo dia útil.
  - **Opção B (Recomendada):** Faixa clara em dias úteis ou horas (ex.: `1 a 2 dias úteis após confirmação do pagamento`), exibida no rótulo da zona.
- **Campo configurável:** `DeliveryZone.estimatedDaysMin`, `DeliveryZone.estimatedDaysMax`, `DeliveryZone.estimatedLabel`.
- **Decisão do cliente:**
  - Prazo padrão a exibir ao cliente: `[ _________________________________ ]`
  - Horário de corte para envio no mesmo dia (se aplicável): `[ _________________ ]`

---

### Decisão 05 — Pedido mínimo
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Se houver pedido mínimo (em centavos), o checkout bloqueia o avanço abaixo desse subtotal (ou exibe aviso no carrinho informando quanto falta). Para roupas, normalmente não há restrição ou define-se valor baixo.
- **Opções e recomendação:**
  - **Opção A (Recomendada):** Sem pedido mínimo (`minOrderCents = 0`) para maximizar conversão, especialmente para acessórios.
  - **Opção B:** Exigir pedido mínimo apenas para entrega local (não para retirada).
- **Campo configurável:** `StoreConfig.minOrderCents`.
- **Decisão do cliente:**
  - `[ ]` Sem pedido mínimo (`0`)
  - `[ ]` Pedido mínimo de: `[ _________________ ]`

---

### Decisão 06 — Retirada no estabelecimento
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Quando ativa, clientes fora da área de entrega local ou que querem economizar frete podem escolher `STORE_PICKUP` no checkout. Exige um estado próprio (`READY_FOR_PICKUP`) no fluxo operacional e endereço/horário claros.
- **Opções e recomendação:**
  - **Opção A:** Habilitar retirada gratuita no endereço da loja/ateliê somente após e-mail de *"Pronto para retirada"*.
  - **Opção B:** Apenas entrega local (sem ponto físico aberto ao público).
- **Campo configurável:** `StoreConfig.storePickupEnabled`, `StoreConfig.storePickupAddress`, `StoreConfig.storePickupInstructions`.
- **Decisão do cliente:**
  - `[ ]` Sim, habilitar retirada na loja — Endereço/horário/prazo de liberação: `[ _____________________________ ]`
  - `[ ]` Não, apenas entrega local

---

### Decisão 07 — Pagamento na entrega
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Permitir pagamento apenas na entrega (`PAY_ON_DELIVERY` — dinheiro ou maquininha do entregador) aumenta risco de desistência na porta, estoque preso durante o trajeto e exige conciliação manual de recebimento.
- **Opções e recomendação:**
  - **Opção A (Recomendada no MVP):** **Desativado (`false`)** — aceitar apenas pagamento antecipado online (Pix ou Cartão) para garantir confirmação automática e baixa segura de estoque.
  - **Opção B:** Ativado apenas para entregas locais selecionadas via flag no Admin, com regra explícita de validação pelo entregador.
- **Campo configurável:** `StoreConfig.payOnDeliveryEnabled`.
- **Decisão do cliente:**
  - `[ ]` Não permitir pagamento na entrega (somente Pix/Cartão online — recomendado)
  - `[ ]` Sim, permitir pagamento na entrega (especificar meios aceitos: `[ _________________ ]`)

---

### Decisão 08 — Prazo de reserva de estoque
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Define por quantos minutos uma unidade fica reservada (`StockReservation`) enquanto o cliente conclui o Pix ou a aprovação do cartão. Prazos muito longos travam estoque de peças únicas; prazos muito curtos vencem antes do cliente copiar o código Pix.
- **Opções e recomendação:**
  - **Recomendação Técnica:** **30 minutos para Pix** (`pixReservationMinutes = 30`) e **15 minutos para Cartão** (`cardReservationMinutes = 15`), ambos com contador regressivo visível na tela do Pix e liberação automática via cron após vencimento.
- **Campo configurável:** `StoreConfig.pixReservationMinutes` e `StoreConfig.cardReservationMinutes`.
- **Decisão do cliente:**
  - Reserva Pix (minutos): `[ ]` 30 min (recomendado)  `[ ]` Outro: `[ ____ ]` min
  - Reserva Cartão (minutos): `[ ]` 15 min (recomendado)  `[ ]` Outro: `[ ____ ]` min

---

### Decisão 09 — Política de troca de roupas
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Vestuário tem alta taxa de troca por tamanho/caimento. Uma política clara reduz abandono no PDP e disputas no suporte.
- **Opções e recomendação:**
  - Definir prazo (ex.: **7 a 30 dias corridos** após o recebimento), condições da peça (sem uso, sem odores/lavagem, etiqueta/lacre intactos), exceções (peças íntimas/biquínis/promoções se aplicável dentro da lei) e quem arca com a nova entrega local na primeira troca.
- **Campo configurável:** `StorePolicy` (`type = EXCHANGE`).
- **Decisão do cliente:**
  - Prazo aceito para troca por gosto/tamanho: `[ ____ ]` dias corridos
  - Primeira troca tem entrega local gratuita? `[ ]` Sim  `[ ]` Não (custo do cliente)  `[ ]` Retirada/troca presencial
  - Restrições ou observações específicas: `[ _________________________________ ]`

---

### Decisão 10 — Política de devolução
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** No Brasil, o **Art. 49 do Código de Defesa do Consumidor (CDC)** determina obrigatoriamente o **direito de arrependimento em no mínimo 7 dias corridos** a contar do recebimento do produto comprado pela internet, com restituição integral dos valores pagos (incluindo taxa de entrega) pelo mesmo meio de pagamento (estorno Pix/Cartão).
- **Opções e recomendação:** Adotar o prazo legal de 7 dias corridos para arrependimento e definir procedimento operacional de coleta local/devolução presencial + prazo de conferência para estorno (ex.: até 2 dias úteis após recebimento da peça).
- **Campo configurável:** `StorePolicy` (`type = RETURN`).
- **Decisão do cliente:**
  - Prazo para arrependimento: `[ ]` 7 dias corridos (mínimo legal CDC)  `[ ]` Prazo estendido: `[ ____ ]` dias
  - Como será coletada a devolução (coleta local ou entrega na loja)? `[ _________________________________ ]`

---

### Decisão 11 — Quantidade de imagens por produto
- **Situação atual:** A definir.
- **Contexto e impacto técnico/UX:** Define o limite de validação no upload do Admin (`ProductImage`) e orienta a padronização da grade/galeria na PDP (ex.: frente, costas, detalhe de tecido, foto no corpo e variações de cor).
- **Opções e recomendação:**
  - **Recomendação:** Mínimo **1 imagem obrigatória** para publicar produto ativo, **4 a 6 recomendadas** para boa conversão, e **limite máximo configurável de 8 (ou 10) imagens** por produto (podendo associar imagens específicas a uma cor via `ProductImage.optionValueId`).
- **Campo configurável:** `StoreConfig.maxImagesPerProduct`.
- **Decisão do cliente:**
  - Máximo permitido por produto: `[ ]` 8 imagens (recomendado)  `[ ]` Outro: `[ ____ ]` imagens
  - Fotos associadas por cor serão usadas? `[ ]` Sim  `[ ]` Não inicialmente

---

### Decisão 12 — Variações obrigatórias
- **Situação atual:** Pendente.
- **Contexto e impacto técnico/UX:** Orienta o cadastro manual no painel Admin e o comportamento da matriz de variantes (`RN10`). Produtos simples (ex.: bolsa, boné tamanho único) não exibem seletores obrigatórios ao cliente; produtos variáveis exigem seleção completa antes de habilitar *"Adicionar ao carrinho"*.
- **Opções e recomendação:**
  - **Recomendação:** Para **Roupas** (`hasVariants = true`), padrão sugerido `Cor` e `Tamanho` (ou `Tamanho` único quando aplicável, podendo incluir `Modelo`/`Estampa` sob demanda). Para **Acessórios** (`hasVariants = false`), permitir produto simples sem variação comercial (`isDefault = true`).
- **Campo configurável:** `StoreConfig.requiredVariantAttributes` (lista sugestão para Admin) e `ProductOption.isRequired`.
- **Decisão do cliente:**
  - Padrão para roupas: `[ ]` Cor e Tamanho  `[ ]` Apenas Tamanho  `[ ]` Outro: `[ _________________ ]`
  - Acessórios podem ser cadastrados como produto simples? `[ ]` Sim (recomendado)  `[ ]` Não

---

## Bloco C — Decisões Complementares de Pagamento (`T12`)

Antes de contratar ou configurar as chaves de produção do gateway (ver comparativo em [03-ARQUITETURA-E-SEGURANCA.md](./03-ARQUITETURA-E-SEGURANCA.md)), definir:

| Item | Opções / Referência | Campo no Sistema | Decisão do Cliente |
| --- | --- | --- | --- |
| **C01 — Gateway de Pagamento Escolhido** | Mercado Pago / Pagar.me / Asaas (após análise comparativa) | `StoreConfig.activePaymentProvider` | `[ Preencher ]` |
| **C02 — Parcelamento Máximo no Cartão** | Ex.: até `3x`, `6x` ou `12x` | `StoreConfig.maxInstallments` | `[ Preencher ]` |
| **C03 — Parcela Mínima no Cartão** | Ex.: `R$ 20,00` ou `R$ 30,00` | `StoreConfig.minInstallmentCents` | `[ Preencher ]` |
| **C04 — Juros do Parcelamento** | Lojista absorve sem juros até Nx vs repasse ao comprador | Política comercial + Gateway | `[ Preencher ]` |

---

## Bloco D — Quadro Formal de Aprovação (Sign-Off)

| Campo | Registro |
| --- | --- |
| **Versão do Caderno** | `1.0` |
| **Status Atual** | `[ ] Aguardando Reunião   [ ] Aprovado Parcialmente   [ ] Aprovado para Produção` |
| **Data da Aprovação** | `____ / ____ / 2026` |
| **Responsável pelo Negócio / Lojista** | Nome: `___________________________________` |
| **Responsável Técnico** | Nome: `___________________________________` |
| **Observações / Ressalvas** | `_________________________________________________________________________` |
