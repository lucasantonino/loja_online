import { describe, expect, it } from "vitest";
import {
  buildOptionCombinationKey,
  buildSuggestedSku,
  DEFAULT_OPTION_COMBINATION_KEY,
  slugify,
} from "@/modules/variants/combination-key";
import {
  computeOptionAvailability,
  generateVariantMatrix,
  resolveAvailableStock,
  type AvailabilityOption,
  type AvailabilityVariant,
} from "@/modules/variants/matrix";

describe("variants domain (RN20, RN21, CA04, CA05)", () => {
  it("mantem DEFAULT para variante padrao de produto simples", () => {
    expect(DEFAULT_OPTION_COMBINATION_KEY).toBe("DEFAULT");
  });

  it("gera optionCombinationKey deterministica independente da ordem de entrada", () => {
    const k1 = buildOptionCombinationKey(["optv_tam_m", "optv_cor_preta"]);
    const k2 = buildOptionCombinationKey(["optv_cor_preta", "optv_tam_m"]);
    expect(k1).toBe("optv_cor_preta|optv_tam_m");
    expect(k1).toBe(k2);
  });

  it("rejeita combinacoes vazias ou com valores duplicados", () => {
    expect(() => buildOptionCombinationKey([])).toThrow();
    expect(() => buildOptionCombinationKey(["optv_a", "optv_a"])).toThrow();
    expect(() => buildOptionCombinationKey(["  "])).toThrow();
  });

  it("gera slug e SKU sugerido deterministico", () => {
    expect(slugify("Camiseta Básica Algodão")).toBe("camiseta-basica-algodao");
    expect(buildSuggestedSku("camiseta-basica", ["preta", "m"])).toBe("CAMISETA-BASICA-PRETA-M");
  });

  it("gera produto cartesiano completo de matriz de variantes", () => {
    const matrix = generateVariantMatrix("camiseta-basica", [
      {
        id: "opt_cor",
        name: "Cor",
        slug: "cor",
        values: [
          { id: "val_preta", value: "Preta", slug: "preta" },
          { id: "val_branca", value: "Branca", slug: "branca" },
        ],
      },
      {
        id: "opt_tam",
        name: "Tamanho",
        slug: "tamanho",
        values: [
          { id: "val_p", value: "P", slug: "p" },
          { id: "val_m", value: "M", slug: "m" },
          { id: "val_g", value: "G", slug: "g" },
        ],
      },
    ]);

    expect(matrix).toHaveLength(6);
    expect(matrix[0]).toEqual({
      optionCombinationKey: "val_p|val_preta",
      optionValueIds: ["val_preta", "val_p"],
      label: "Preta · P",
      suggestedSku: "CAMISETA-BASICA-PRETA-P",
    });
  });

  describe("disponibilidade cruzada Camiseta Basica (CA04 / CA05)", () => {
    const options: AvailabilityOption[] = [
      {
        id: "opt_cor",
        name: "Cor",
        slug: "cor",
        isRequired: true,
        values: [
          { id: "cor_preta", value: "Preta", slug: "preta", colorHex: "#171717" },
          { id: "cor_branca", value: "Branca", slug: "branca", colorHex: "#FAFAFA" },
        ],
      },
      {
        id: "opt_tam",
        name: "Tamanho",
        slug: "tamanho",
        isRequired: true,
        values: [
          { id: "tam_p", value: "P", slug: "p" },
          { id: "tam_m", value: "M", slug: "m" },
          { id: "tam_g", value: "G", slug: "g" },
        ],
      },
    ];

    const variants: AvailabilityVariant[] = [
      {
        id: "v_preta_p",
        sku: "CAM-PRETA-P",
        label: "Preta · P",
        priceCents: 8990,
        stockOnHand: 4,
        stockReserved: 0,
        isActive: true,
        optionValueIds: ["cor_preta", "tam_p"],
      },
      {
        id: "v_preta_m",
        sku: "CAM-PRETA-M",
        label: "Preta · M",
        priceCents: 8990,
        stockOnHand: 5,
        stockReserved: 1,
        isActive: true,
        optionValueIds: ["cor_preta", "tam_m"],
      },
      {
        id: "v_preta_g",
        sku: "CAM-PRETA-G",
        label: "Preta · G",
        priceCents: 8990,
        stockOnHand: 3,
        stockReserved: 0,
        isActive: true,
        optionValueIds: ["cor_preta", "tam_g"],
      },
      {
        id: "v_branca_p",
        sku: "CAM-BRANCA-P",
        label: "Branca · P",
        priceCents: 8990,
        stockOnHand: 2,
        stockReserved: 0,
        isActive: true,
        optionValueIds: ["cor_branca", "tam_p"],
      },
      {
        id: "v_branca_m",
        sku: "CAM-BRANCA-M",
        label: "Branca · M",
        priceCents: 8990,
        stockOnHand: 1,
        stockReserved: 1, // disponivel = 0
        isActive: true,
        optionValueIds: ["cor_branca", "tam_m"],
      },
      {
        id: "v_branca_g",
        sku: "CAM-BRANCA-G",
        label: "Branca · G",
        priceCents: 8990,
        stockOnHand: 3,
        stockReserved: 0,
        isActive: true,
        optionValueIds: ["cor_branca", "tam_g"],
      },
    ];

    it("mantem M disponivel sem cor selecionada porque Preta + M tem estoque", () => {
      const result = computeOptionAvailability(options, variants, {});
      const sizeGroup = result.options.find((o) => o.slug === "tamanho");
      const mState = sizeGroup?.values.find((v) => v.slug === "m");

      expect(mState?.inStock).toBe(true);
      expect(result.allRequiredSelected).toBe(false);
      expect(result.matchedVariant).toBeNull();
    });

    it("ao selecionar Branca, marca M como indisponivel sem bloquear P e G (CA05)", () => {
      const result = computeOptionAvailability(options, variants, {
        opt_cor: "cor_branca",
      });
      const sizeGroup = result.options.find((o) => o.slug === "tamanho");

      expect(sizeGroup?.values.find((v) => v.slug === "p")?.inStock).toBe(true);
      expect(sizeGroup?.values.find((v) => v.slug === "m")?.inStock).toBe(false);
      expect(sizeGroup?.values.find((v) => v.slug === "g")?.inStock).toBe(true);

      // Cor Preta continua disponivel como alternativa no grupo Cor
      const colorGroup = result.options.find((o) => o.slug === "cor");
      expect(colorGroup?.values.find((v) => v.slug === "preta")?.inStock).toBe(true);
    });

    it("identifica variante exata ao selecionar Preta + M (CA04)", () => {
      const result = computeOptionAvailability(options, variants, {
        opt_cor: "cor_preta",
        opt_tam: "tam_m",
      });

      expect(result.allRequiredSelected).toBe(true);
      expect(result.isMatchedInStock).toBe(true);
      expect(result.matchedVariant?.id).toBe("v_preta_m");
      expect(result.matchedVariant?.availableStock).toBe(4);
    });

    it("calcula saldo disponivel sem ficar negativo", () => {
      expect(resolveAvailableStock({ stockOnHand: 5, stockReserved: 2 })).toBe(3);
      expect(resolveAvailableStock({ stockOnHand: 1, stockReserved: 3 })).toBe(0);
    });
  });
});
