import { PolicyType, PrismaClient, ProductStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  buildOptionCombinationKey,
  DEFAULT_OPTION_COMBINATION_KEY,
  DEFAULT_VARIANT_LABEL,
  slugify,
} from "../src/modules/variants/combination-key";

const prisma = new PrismaClient();

async function ensureInitialMovement(params: {
  productId: string;
  variantId: string;
  stockOnHand: number;
  actorUserId: string;
  reason: string;
}) {
  if (params.stockOnHand <= 0) {
    return;
  }

  const existing = await prisma.inventoryMovement.findFirst({
    where: {
      variantId: params.variantId,
      type: "INITIAL",
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await prisma.inventoryMovement.create({
    data: {
      productId: params.productId,
      variantId: params.variantId,
      actorUserId: params.actorUserId,
      type: "INITIAL",
      quantityDelta: params.stockOnHand,
      reservedDelta: 0,
      stockOnHandAfter: params.stockOnHand,
      stockReservedAfter: 0,
      reason: params.reason,
    },
  });
}

async function seedSimpleProduct(params: {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  basePriceCents: number;
  compareAtPriceCents?: number | null;
  status: ProductStatus;
  sku: string;
  initialStock: number;
  actorUserId: string;
}) {
  const product = await prisma.product.upsert({
    where: { slug: params.slug },
    update: {
      name: params.name,
      description: params.description,
      shortDescription: params.shortDescription,
      categoryId: params.categoryId,
      basePriceCents: params.basePriceCents,
      compareAtPriceCents: params.compareAtPriceCents ?? null,
      hasVariants: false,
      status: params.status,
      deletedAt: null,
    },
    create: {
      name: params.name,
      slug: params.slug,
      description: params.description,
      shortDescription: params.shortDescription,
      categoryId: params.categoryId,
      basePriceCents: params.basePriceCents,
      compareAtPriceCents: params.compareAtPriceCents ?? null,
      hasVariants: false,
      status: params.status,
    },
  });

  const existingVariant = await prisma.productVariant.findUnique({
    where: { sku: params.sku },
    select: { id: true },
  });

  const variant =
    existingVariant ??
    (await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: params.sku,
        isDefault: true,
        optionCombinationKey: DEFAULT_OPTION_COMBINATION_KEY,
        label: DEFAULT_VARIANT_LABEL,
        priceCents: params.basePriceCents,
        compareAtPriceCents: params.compareAtPriceCents ?? null,
        stockOnHand: params.initialStock,
        stockReserved: 0,
        isActive: true,
      },
    }));

  await ensureInitialMovement({
    productId: product.id,
    variantId: variant.id,
    stockOnHand: params.initialStock,
    actorUserId: params.actorUserId,
    reason: `Carga inicial (seed) - ${params.sku}`,
  });

  return product;
}

async function seedVariableProduct(params: {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  basePriceCents: number;
  compareAtPriceCents?: number | null;
  sizeGuideMarkdown?: string;
  status: ProductStatus;
  actorUserId: string;
  options: Array<{
    name: string;
    slug: string;
    sortOrder: number;
    values: Array<{
      value: string;
      slug: string;
      colorHex?: string;
      sortOrder: number;
    }>;
  }>;
  variants: Array<{
    sku: string;
    label: string;
    priceCents: number;
    stockOnHand: number;
    optionRefs: string[]; // formato "optSlug:valSlug"
  }>;
}) {
  const product = await prisma.product.upsert({
    where: { slug: params.slug },
    update: {
      name: params.name,
      description: params.description,
      shortDescription: params.shortDescription,
      categoryId: params.categoryId,
      basePriceCents: params.basePriceCents,
      compareAtPriceCents: params.compareAtPriceCents ?? null,
      sizeGuideMarkdown: params.sizeGuideMarkdown ?? null,
      hasVariants: true,
      status: params.status,
      deletedAt: null,
    },
    create: {
      name: params.name,
      slug: params.slug,
      description: params.description,
      shortDescription: params.shortDescription,
      categoryId: params.categoryId,
      basePriceCents: params.basePriceCents,
      compareAtPriceCents: params.compareAtPriceCents ?? null,
      sizeGuideMarkdown: params.sizeGuideMarkdown ?? null,
      hasVariants: true,
      status: params.status,
    },
  });

  const valueIdByRef = new Map<string, string>();

  for (const opt of params.options) {
    const dbOption = await prisma.productOption.upsert({
      where: {
        productId_slug: {
          productId: product.id,
          slug: opt.slug,
        },
      },
      update: {
        name: opt.name,
        sortOrder: opt.sortOrder,
      },
      create: {
        productId: product.id,
        name: opt.name,
        slug: opt.slug,
        isRequired: true,
        sortOrder: opt.sortOrder,
      },
    });

    for (const val of opt.values) {
      const dbValue = await prisma.productOptionValue.upsert({
        where: {
          optionId_slug: {
            optionId: dbOption.id,
            slug: val.slug,
          },
        },
        update: {
          value: val.value,
          colorHex: val.colorHex ?? null,
          sortOrder: val.sortOrder,
        },
        create: {
          optionId: dbOption.id,
          value: val.value,
          slug: val.slug,
          colorHex: val.colorHex ?? null,
          sortOrder: val.sortOrder,
        },
      });
      valueIdByRef.set(`${opt.slug}:${val.slug}`, dbValue.id);
    }
  }

  for (const variantSpec of params.variants) {
    const optionValueIds = variantSpec.optionRefs.map((ref) => {
      const id = valueIdByRef.get(ref);
      if (!id) {
        throw new Error(`Valor de opcao nao encontrado no seed: ${ref}`);
      }
      return id;
    });

    const optionCombinationKey = buildOptionCombinationKey(optionValueIds);

    const existingVariant = await prisma.productVariant.findUnique({
      where: { sku: variantSpec.sku },
      select: { id: true },
    });

    const variant =
      existingVariant ??
      (await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: variantSpec.sku,
          isDefault: false,
          optionCombinationKey,
          label: variantSpec.label,
          priceCents: variantSpec.priceCents,
          compareAtPriceCents: params.compareAtPriceCents ?? null,
          stockOnHand: variantSpec.stockOnHand,
          stockReserved: 0,
          isActive: true,
        },
      }));

    if (!existingVariant) {
      await prisma.productVariantOptionValue.createMany({
        data: optionValueIds.map((optionValueId) => ({
          variantId: variant.id,
          optionValueId,
        })),
        skipDuplicates: true,
      });
    }

    await ensureInitialMovement({
      productId: product.id,
      variantId: variant.id,
      stockOnHand: variantSpec.stockOnHand,
      actorUserId: params.actorUserId,
      reason: `Carga inicial (seed) - ${variantSpec.sku}`,
    });
  }

  return product;
}

async function main() {
  const isProd = process.env.NODE_ENV === "production";
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (isProd && (!adminEmail || !adminPassword)) {
    throw new Error(
      "Em producao, SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD sao obrigatorios para executar o seed.",
    );
  }

  const resolvedAdminEmail = adminEmail ?? "admin@loja.local";
  const resolvedAdminPassword = adminPassword ?? "TrocarSenhaAdmin!2026";
  const adminHash = await hashPassword(resolvedAdminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: resolvedAdminEmail },
    update: {
      name: "Administrador da Loja",
      role: "ADMIN",
      isActive: true,
    },
    create: {
      name: "Administrador da Loja",
      email: resolvedAdminEmail,
      passwordHash: adminHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  if (!isProd) {
    const customerHash = await hashPassword("ClienteDemo!2026");
    await prisma.user.upsert({
      where: { email: "cliente@loja.local" },
      update: { name: "Cliente Demonstracao" },
      create: {
        name: "Cliente Demonstracao",
        email: "cliente@loja.local",
        passwordHash: customerHash,
        phone: "11999990000",
        role: "CUSTOMER",
        isActive: true,
      },
    });
  }

  await prisma.storeConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: "Atelie & Vestuario (Staging)",
      legalName: "Loja Modelo Vestuario Ltda (Provisorio)",
      cnpj: null,
      supportEmail: "atendimento@loja.local",
      supportWhatsapp: null,
      physicalAddress: "Definir apos aprovacao comercial (docs/01)",
      serviceHours: "Seg a Sex, 09h as 18h",
      primaryCity: "Sao Paulo",
      primaryState: "SP",
      minOrderCents: 0,
      storePickupEnabled: false,
      storePickupAddress: null,
      storePickupInstructions: null,
      payOnDeliveryEnabled: false,
      pixReservationMinutes: 30,
      cardReservationMinutes: 15,
      maxImagesPerProduct: 8,
      maxInstallments: 6,
      minInstallmentCents: 2000,
      activePaymentProvider: "mercadopago",
      requiredVariantAttributes: ["Cor", "Tamanho"],
    },
  });

  const basePolicies: Array<{
    type: PolicyType;
    title: string;
    slug: string;
    contentMarkdown: string;
  }> = [
    {
      type: "EXCHANGE",
      title: "Politica de Trocas",
      slug: "trocas",
      contentMarkdown:
        "# Politica de Trocas (Rascunho)\n\nSolicitacoes de troca por tamanho ou preferencia devem ser feitas dentro do prazo definido pelo lojista apos aprovacao comercial (`docs/01`). A peca deve estar sem uso e com etiqueta intacta.",
    },
    {
      type: "RETURN",
      title: "Politica de Devolucao e Arrependimento",
      slug: "trocas-e-devolucoes",
      contentMarkdown:
        "# Direito de Arrependimento (CDC Art. 49)\n\nConforme o Art. 49 do Codigo de Defesa do Consumidor, compras realizadas pela internet podem ser devolvidas por arrependimento em ate **7 dias corridos** a contar do recebimento, com estorno integral pelo mesmo meio de pagamento.",
    },
    {
      type: "PRIVACY",
      title: "Politica de Privacidade (LGPD)",
      slug: "privacidade",
      contentMarkdown:
        "# Politica de Privacidade (Rascunho)\n\nOs dados pessoais coletados sao utilizados exclusivamente para processamento de pedidos, entrega local, comunicacao transacional e cumprimento de obrigacoes legais conforme a LGPD (Lei 13.709/2018).",
    },
    {
      type: "TERMS",
      title: "Termos de Uso",
      slug: "termos",
      contentMarkdown:
        "# Termos de Uso (Rascunho)\n\nCondicoes gerais de navegacao, compra e pagamento da loja virtual.",
    },
    {
      type: "SHIPPING",
      title: "Politica de Entrega Local",
      slug: "entrega",
      contentMarkdown:
        "# Entrega Local (Rascunho)\n\nAs entregas ocorrem dentro das zonas e faixas de CEP ativas configuradas em `DeliveryZone` apos confirmacao do pagamento.",
    },
  ];

  for (const policy of basePolicies) {
    await prisma.storePolicy.upsert({
      where: { type: policy.type },
      update: {},
      create: {
        type: policy.type,
        title: policy.title,
        slug: policy.slug,
        contentMarkdown: policy.contentMarkdown,
        version: 1,
        publishedAt: null,
      },
    });
  }

  // Arvore de categorias
  const roupas = await prisma.category.upsert({
    where: { slug: "roupas" },
    update: { name: "Roupas", sortOrder: 1, isActive: true },
    create: {
      name: "Roupas",
      slug: "roupas",
      description: "Pecas essenciais de vestuario com modelagem versatil.",
      sortOrder: 1,
      isActive: true,
    },
  });

  const acessorios = await prisma.category.upsert({
    where: { slug: "acessorios" },
    update: { name: "Acessorios", sortOrder: 2, isActive: true },
    create: {
      name: "Acessorios",
      slug: "acessorios",
      description: "Bolsas, cintos e complementos.",
      sortOrder: 2,
      isActive: true,
    },
  });

  const camisetas = await prisma.category.upsert({
    where: { slug: "camisetas" },
    update: { name: "Camisetas", parentId: roupas.id, sortOrder: 1, isActive: true },
    create: {
      name: "Camisetas",
      slug: "camisetas",
      parentId: roupas.id,
      sortOrder: 1,
      isActive: true,
    },
  });

  const vestidos = await prisma.category.upsert({
    where: { slug: "vestidos" },
    update: { name: "Vestidos", parentId: roupas.id, sortOrder: 2, isActive: true },
    create: {
      name: "Vestidos",
      slug: "vestidos",
      parentId: roupas.id,
      sortOrder: 2,
      isActive: true,
    },
  });

  const bolsas = await prisma.category.upsert({
    where: { slug: "bolsas" },
    update: { name: "Bolsas", parentId: acessorios.id, sortOrder: 1, isActive: true },
    create: {
      name: "Bolsas",
      slug: "bolsas",
      parentId: acessorios.id,
      sortOrder: 1,
      isActive: true,
    },
  });

  // 1. Produto simples com estoque (CA01)
  await seedSimpleProduct({
    name: "Bolsa Tote Lona",
    slug: "bolsa-tote-lona",
    description:
      "Bolsa tote em lona encorpada de algodao com alcas reforcadas e bolso interno.",
    shortDescription: "Lona encorpada de algodao · Tamanho unico",
    categoryId: bolsas.id,
    basePriceCents: 14900,
    compareAtPriceCents: 17900,
    status: "ACTIVE",
    sku: "BOLSA-TOTE-LONA-UN",
    initialStock: 10,
    actorUserId: adminUser.id,
  });

  // 2. Produto variavel canonico CA04 / CA05 (Branca + M = 0)
  await seedVariableProduct({
    name: "Camiseta Basica Algodao",
    slug: "camiseta-basica-algodao",
    description:
      "Camiseta basica em malha 100% algodao penteado, toque macio e caimento reto.",
    shortDescription: "100% algodao penteado · Modelagem regular",
    categoryId: camisetas.id,
    basePriceCents: 8990,
    compareAtPriceCents: null,
    sizeGuideMarkdown:
      "| Tamanho | Torax (cm) | Comprimento (cm) |\n| --- | --- | --- |\n| P | 98 | 68 |\n| M | 104 | 71 |\n| G | 110 | 74 |",
    status: "ACTIVE",
    actorUserId: adminUser.id,
    options: [
      {
        name: "Cor",
        slug: "cor",
        sortOrder: 1,
        values: [
          { value: "Preta", slug: "preta", colorHex: "#171717", sortOrder: 1 },
          { value: "Branca", slug: "branca", colorHex: "#FAFAFA", sortOrder: 2 },
        ],
      },
      {
        name: "Tamanho",
        slug: "tamanho",
        sortOrder: 2,
        values: [
          { value: "P", slug: "p", sortOrder: 1 },
          { value: "M", slug: "m", sortOrder: 2 },
          { value: "G", slug: "g", sortOrder: 3 },
        ],
      },
    ],
    variants: [
      {
        sku: "CAM-BAS-PRETA-P",
        label: "Preta · P",
        priceCents: 8990,
        stockOnHand: 8,
        optionRefs: ["cor:preta", "tamanho:p"],
      },
      {
        sku: "CAM-BAS-PRETA-M",
        label: "Preta · M",
        priceCents: 8990,
        stockOnHand: 12,
        optionRefs: ["cor:preta", "tamanho:m"],
      },
      {
        sku: "CAM-BAS-PRETA-G",
        label: "Preta · G",
        priceCents: 8990,
        stockOnHand: 5,
        optionRefs: ["cor:preta", "tamanho:g"],
      },
      {
        sku: "CAM-BAS-BRANCA-P",
        label: "Branca · P",
        priceCents: 8990,
        stockOnHand: 6,
        optionRefs: ["cor:branca", "tamanho:p"],
      },
      {
        sku: "CAM-BAS-BRANCA-M",
        label: "Branca · M",
        priceCents: 8990,
        stockOnHand: 0, // Cenario obrigatorio CA04 / CA05
        optionRefs: ["cor:branca", "tamanho:m"],
      },
      {
        sku: "CAM-BAS-BRANCA-G",
        label: "Branca · G",
        priceCents: 8990,
        stockOnHand: 4,
        optionRefs: ["cor:branca", "tamanho:g"],
      },
    ],
  });

  // 3. Vestido Midi Linho
  await seedVariableProduct({
    name: "Vestido Midi Linho",
    slug: "vestido-midi-linho",
    description: "Vestido midi em blend de linho e viscose com alcas regulaveis.",
    shortDescription: "Blend de linho e viscose",
    categoryId: vestidos.id,
    basePriceCents: 26900,
    compareAtPriceCents: 31900,
    status: "ACTIVE",
    actorUserId: adminUser.id,
    options: [
      {
        name: "Cor",
        slug: "cor",
        sortOrder: 1,
        values: [
          { value: "Areia", slug: "areia", colorHex: "#D6C7B2", sortOrder: 1 },
          { value: "Oliva", slug: "oliva", colorHex: "#556B2F", sortOrder: 2 },
        ],
      },
      {
        name: "Tamanho",
        slug: "tamanho",
        sortOrder: 2,
        values: [
          { value: "P", slug: "p", sortOrder: 1 },
          { value: "M", slug: "m", sortOrder: 2 },
          { value: "G", slug: "g", sortOrder: 3 },
        ],
      },
    ],
    variants: [
      {
        sku: "VEST-MIDI-AREIA-P",
        label: "Areia · P",
        priceCents: 26900,
        stockOnHand: 3,
        optionRefs: ["cor:areia", "tamanho:p"],
      },
      {
        sku: "VEST-MIDI-AREIA-M",
        label: "Areia · M",
        priceCents: 26900,
        stockOnHand: 5,
        optionRefs: ["cor:areia", "tamanho:m"],
      },
      {
        sku: "VEST-MIDI-OLIVA-M",
        label: "Oliva · M",
        priceCents: 26900,
        stockOnHand: 2,
        optionRefs: ["cor:oliva", "tamanho:m"],
      },
      {
        sku: "VEST-MIDI-OLIVA-G",
        label: "Oliva · G",
        priceCents: 26900,
        stockOnHand: 4,
        optionRefs: ["cor:oliva", "tamanho:g"],
      },
    ],
  });

  // 4. Produto simples esgotado (CA03)
  await seedSimpleProduct({
    name: "Jaqueta Sarja Edicao Limitada",
    slug: "jaqueta-sarja-edicao-limitada",
    description: "Jaqueta utilitaria em sarja pesada. Lote esgotado para demonstracao do CA03.",
    shortDescription: "Sarja pesada · Edicao limitada",
    categoryId: roupas.id,
    basePriceCents: 32900,
    status: "ACTIVE",
    sku: "JAQ-SARJA-LIM-UN",
    initialStock: 0,
    actorUserId: adminUser.id,
  });

  // 5. Acessorio variavel com 1 unidade na ultima variante (CA11)
  await seedVariableProduct({
    name: "Cinto Couro Fivela Dourada",
    slug: "cinto-couro-fivela-dourada",
    description: "Cinto em couro legitimo com fivela metalica de acabamento escovado.",
    shortDescription: "Couro legitimo · Fivela escovada",
    categoryId: acessorios.id,
    basePriceCents: 11900,
    status: "ACTIVE",
    actorUserId: adminUser.id,
    options: [
      {
        name: "Tamanho",
        slug: "tamanho",
        sortOrder: 1,
        values: [
          { value: "P/M", slug: slugify("P/M"), sortOrder: 1 },
          { value: "G/GG", slug: slugify("G/GG"), sortOrder: 2 },
        ],
      },
    ],
    variants: [
      {
        sku: "CINTO-COURO-PM",
        label: "P/M",
        priceCents: 11900,
        stockOnHand: 5,
        optionRefs: [`tamanho:${slugify("P/M")}`],
      },
      {
        sku: "CINTO-COURO-GGG",
        label: "G/GG",
        priceCents: 11900,
        stockOnHand: 1,
        optionRefs: [`tamanho:${slugify("G/GG")}`],
      },
    ],
  });

  // Zona de entrega local de teste
  const existingZone = await prisma.deliveryZone.findFirst({
    where: { name: "Centro e Regiao (Staging)" },
    select: { id: true },
  });

  if (!existingZone) {
    await prisma.deliveryZone.create({
      data: {
        name: "Centro e Regiao (Staging)",
        city: "Sao Paulo",
        state: "SP",
        matchType: "CEP_RANGE",
        cepStart: "01000000",
        cepEnd: "01599999",
        neighborhoods: ["Centro", "Bela Vista", "Consolacao"],
        feeCents: 1500,
        freeShippingMinCents: 25000,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        estimatedLabel: "1 a 2 dias uteis",
        isActive: true,
        sortOrder: 1,
      },
    });
  }

  console.info("Seed inicial concluido com sucesso.");
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
