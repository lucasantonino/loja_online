import { describe, expect, it } from "vitest";
import {
  computeCartState,
  planVisitorCartMerge,
  type RawCartItemRecord,
} from "@/modules/cart/cart-math";
import { addCartItemSchema, updateCartItemSchema } from "@/modules/cart/schemas";

describe("cart math & merge planner (T09, RN11-RN13, RN30, CA06, CA18)", () => {
  const baseProduct = {
    id: "prod_1",
    name: "Camiseta Basica",
    slug: "camiseta-basica",
    status: "ACTIVE",
    deletedAt: null,
    primaryImageUrl: null,
    primaryImageAlt: null,
  };

  it("recalcula subtotais no servidor e detecta alteracao de preco e reducao de estoque (RN13, CA06)", () => {
    const rawItems: RawCartItemRecord[] = [
      {
        id: "ci_1",
        variantId: "var_1",
        quantity: 3,
        unitPriceAtAddCents: 7990,
        variant: {
          id: "var_1",
          sku: "CAM-PRETA-M",
          label: "Preta · M",
          priceCents: 8990, // preco subiu
          compareAtPriceCents: null,
          stockOnHand: 5,
          stockReserved: 0,
          isActive: true,
          deletedAt: null,
          product: baseProduct,
        },
      },
      {
        id: "ci_2",
        variantId: "var_2",
        quantity: 4,
        unitPriceAtAddCents: 14900,
        variant: {
          id: "var_2",
          sku: "BOLSA-UN",
          label: "Padrao",
          priceCents: 14900,
          compareAtPriceCents: null,
          stockOnHand: 3,
          stockReserved: 1, // disponivel = 2 < 4
          isActive: true,
          deletedAt: null,
          product: { ...baseProduct, id: "prod_2", name: "Bolsa Tote" },
        },
      },
    ];

    const state = computeCartState(rawItems);

    expect(state.itemCount).toBe(7);
    expect(state.subtotalCents).toBe(3 * 8990 + 4 * 14900);
    expect(state.priceChanges).toHaveLength(1);
    expect(state.priceChanges[0]).toMatchObject({
      variantId: "var_1",
      oldUnitPriceCents: 7990,
      newUnitPriceCents: 8990,
    });
    expect(state.stockWarnings).toHaveLength(1);
    expect(state.stockWarnings[0]).toMatchObject({
      variantId: "var_2",
      requestedQuantity: 4,
      availableStock: 2,
      reason: "REDUCED_STOCK",
    });
    expect(state.hasBlockingIssues).toBe(true);
  });

  it("executa merge deterministico de carrinho visitante -> usuario respeitando estoque (RN30, CA18)", () => {
    const plan = planVisitorCartMerge({
      userItems: [
        { variantId: "var_preta_m", quantity: 1, unitPriceAtAddCents: 8990 },
      ],
      visitorItems: [
        {
          variantId: "var_preta_m",
          quantity: 4, // 1 + 4 = 5, mas estoque disponivel = 3
          unitPriceAtAddCents: 8990,
          productName: "Camiseta Basica",
          variantLabel: "Preta · M",
          isAvailable: true,
          availableStock: 3,
          currentPriceCents: 8990,
        },
        {
          variantId: "var_branca_m",
          quantity: 1,
          unitPriceAtAddCents: 8990,
          productName: "Camiseta Basica",
          variantLabel: "Branca · M",
          isAvailable: true,
          availableStock: 0, // esgotado
          currentPriceCents: 8990,
        },
        {
          variantId: "var_bolsa",
          quantity: 2,
          unitPriceAtAddCents: 14900,
          productName: "Bolsa Tote",
          variantLabel: "Padrao",
          isAvailable: true,
          availableStock: 10,
          currentPriceCents: 14900,
        },
      ],
    });

    expect(plan.upserts).toEqual([
      { variantId: "var_preta_m", quantity: 3, unitPriceAtAddCents: 8990 },
      { variantId: "var_bolsa", quantity: 2, unitPriceAtAddCents: 14900 },
    ]);

    expect(plan.warnings).toHaveLength(2);
    expect(plan.warnings[0]?.type).toBe("QUANTITY_CAPPED");
    expect(plan.warnings[1]?.type).toBe("DISCARDED_UNAVAILABLE");
  });

  it("valida schemas Zod de inclusao e atualizacao do carrinho", () => {
    expect(addCartItemSchema.safeParse({ variantId: "v1", quantity: 0 }).success).toBe(false);
    expect(addCartItemSchema.safeParse({ variantId: "v1", quantity: 2 }).success).toBe(true);
    expect(updateCartItemSchema.safeParse({ quantity: 0 }).success).toBe(true);
    expect(updateCartItemSchema.safeParse({ quantity: -1 }).success).toBe(false);
  });
});
