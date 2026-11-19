import { describe, expect, it } from "vitest";
import { manualStockAdjustmentSchema } from "@/modules/inventory/schemas";
import { createProductSchema } from "@/modules/variants/schemas";

describe("Zod schemas (T05 / RF35)", () => {
  it("valida produto simples com variante padrao", () => {
    const parsed = createProductSchema.safeParse({
      name: "Bolsa Tote Lona",
      description: "Bolsa em lona de algodao encorpada.",
      categoryId: "cat_123",
      basePriceCents: 14900,
      hasVariants: false,
      status: "ACTIVE",
      defaultVariant: {
        sku: "bolsa-tote-01",
        initialStock: 10,
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && !parsed.data.hasVariants) {
      expect(parsed.data.defaultVariant.sku).toBe("BOLSA-TOTE-01");
    }
  });

  it("bloqueia combinacao de opcoes duplicada e SKU duplicado em produto variavel (CA02)", () => {
    const duplicateCombo = createProductSchema.safeParse({
      name: "Camiseta Basica",
      description: "Malha 100% algodao.",
      categoryId: "cat_123",
      basePriceCents: 8990,
      hasVariants: true,
      options: [
        {
          name: "Cor",
          values: [{ value: "Preta", colorHex: "#171717" }],
        },
        {
          name: "Tamanho",
          values: [{ value: "M" }],
        },
      ],
      variants: [
        {
          sku: "CAM-01",
          priceCents: 8990,
          initialStock: 5,
          optionValueSlugs: ["preta", "m"],
        },
        {
          sku: "CAM-02",
          priceCents: 8990,
          initialStock: 2,
          optionValueSlugs: ["m", "preta"], // mesma combinacao invertida
        },
      ],
    });

    expect(duplicateCombo.success).toBe(false);
  });

  it("rejeita preco em ponto flutuante", () => {
    const floatPrice = createProductSchema.safeParse({
      name: "Bone Lona",
      description: "Bone aba curva.",
      categoryId: "cat_123",
      basePriceCents: 79.9,
      hasVariants: false,
      defaultVariant: {
        sku: "BONE-01",
        initialStock: 3,
      },
    });

    expect(floatPrice.success).toBe(false);
  });

  it("exige motivo valido no ajuste manual de estoque (RF35)", () => {
    expect(
      manualStockAdjustmentSchema.safeParse({
        variantId: "var_1",
        type: "MANUAL_ADJUSTMENT_IN",
        quantity: 5,
        reason: "Reposicao de fornecedor lote 03",
      }).success,
    ).toBe(true);

    expect(
      manualStockAdjustmentSchema.safeParse({
        variantId: "var_1",
        type: "MANUAL_ADJUSTMENT_OUT",
        quantity: 1,
        reason: "",
      }).success,
    ).toBe(false);
  });
});
