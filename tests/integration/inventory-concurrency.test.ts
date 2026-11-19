import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ConflictError } from "@/lib/http/api-response";
import { archiveOrDeleteProduct, createProduct } from "@/modules/catalog/catalog.service";
import { adjustVariantStock, reserveStockInTx } from "@/modules/inventory/inventory.service";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "true";

describe.skipIf(!RUN_INTEGRATION)("Integracao PostgreSQL: Produtos, Estoque e Concorrencia", () => {
  const suffix = Date.now().toString(36);
  let categoryId = "";
  let userId = "";
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `Categoria Teste ${suffix}`,
        slug: `cat-teste-${suffix}`,
      },
    });
    categoryId = category.id;

    const user = await prisma.user.create({
      data: {
        name: "Comprador Teste",
        email: `teste-${suffix}@loja.local`,
        role: "CUSTOMER",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.stockReservation.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.inventoryMovement.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }

    if (createdProductIds.length > 0) {
      await prisma.inventoryMovement.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
    }

    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("CA01: cadastra produto simples criando Default Variant e movimentacao INITIAL", async () => {
    const product = await createProduct(
      {
        name: `Bolsa Teste ${suffix}`,
        slug: `bolsa-teste-${suffix}`,
        description: "Produto simples de teste de integracao.",
        categoryId,
        basePriceCents: 12900,
        hasVariants: false,
        status: "ACTIVE",
        defaultVariant: {
          sku: `BOLSA-INT-${suffix}`.toUpperCase(),
          initialStock: 10,
        },
      },
      { actorUserId: userId },
    );

    createdProductIds.push(product.id);
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0]?.isDefault).toBe(true);
    expect(product.variants[0]?.optionCombinationKey).toBe("DEFAULT");
    expect(product.variants[0]?.stockOnHand).toBe(10);
  });

  it("CA02 + RF35: cadastra produto variavel e impede baixa manual maior que estoque disponivel", async () => {
    const product = await createProduct(
      {
        name: `Camiseta Teste ${suffix}`,
        slug: `camiseta-teste-${suffix}`,
        description: "Produto variavel de teste.",
        categoryId,
        basePriceCents: 8990,
        hasVariants: true,
        status: "ACTIVE",
        options: [
          {
            name: "Cor",
            isRequired: true,
            sortOrder: 1,
            values: [{ value: "Preta", colorHex: "#171717", sortOrder: 1 }],
          },
          {
            name: "Tamanho",
            isRequired: true,
            sortOrder: 2,
            values: [{ value: "M", sortOrder: 1 }],
          },
        ],
        variants: [
          {
            sku: `CAM-INT-${suffix}-PRETA-M`.toUpperCase(),
            priceCents: 8990,
            initialStock: 2,
            isActive: true,
            optionValueSlugs: ["preta", "m"],
          },
        ],
      },
      { actorUserId: userId },
    );

    createdProductIds.push(product.id);
    const variantId = product.variants[0]!.id;

    await expect(
      adjustVariantStock(
        {
          variantId,
          type: "MANUAL_ADJUSTMENT_OUT",
          quantity: 5,
          reason: "Tentativa invalida acima do saldo",
        },
        { actorUserId: userId },
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    // Arquivamento preserva historico de movimentacao (RN32)
    const archived = await archiveOrDeleteProduct(product.id, { actorUserId: userId });
    expect(archived.outcome).toBe("ARCHIVED");
  });

  it("CA11: garante que apenas 1 de 3 reservas concorrentes para a ultima peca tenha sucesso", async () => {
    const product = await createProduct(
      {
        name: `Peca Unica ${suffix}`,
        slug: `peca-unica-${suffix}`,
        description: "Teste de concorrencia para ultimo item.",
        categoryId,
        basePriceCents: 19900,
        hasVariants: false,
        status: "ACTIVE",
        defaultVariant: {
          sku: `UNICA-INT-${suffix}`.toUpperCase(),
          initialStock: 1,
        },
      },
      { actorUserId: userId },
    );
    createdProductIds.push(product.id);
    const variantId = product.variants[0]!.id;

    const results = await Promise.allSettled(
      [1, 2, 3].map(async (attempt) =>
        prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              orderNumber: `INT-${suffix}-${attempt}`,
              idempotencyKey: `idem-${suffix}-${attempt}`,
              userId,
              deliveryMethod: "LOCAL_DELIVERY",
              subtotalCents: 19900,
              deliveryFeeCents: 0,
              totalCents: 19900,
              customerNameSnapshot: "Comprador Teste",
              customerEmailSnapshot: `teste-${suffix}@loja.local`,
            },
          });

          await reserveStockInTx(tx, {
            orderId: order.id,
            expiresAt: new Date(Date.now() + 15 * 60_000),
            items: [{ variantId, quantity: 1 }],
            actorUserId: userId,
          });

          return order.id;
        }),
      ),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        createdOrderIds.push(r.value);
      }
    }

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);

    const refreshed = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(refreshed.stockOnHand).toBe(1);
    expect(refreshed.stockReserved).toBe(1);
  });
});
