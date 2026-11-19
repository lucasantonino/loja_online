import { describe, expect, it } from "vitest";
import {
  assertSafeCents,
  calculateLineTotalCents,
  calculateOrderTotalsCents,
  formatBrlFromCents,
  parseReaisToCents,
} from "@/lib/money";

describe("money utilities (RN22)", () => {
  it("valida inteiros nao negativos em centavos", () => {
    expect(assertSafeCents(0)).toBe(0);
    expect(assertSafeCents(8990)).toBe(8990);
    expect(() => assertSafeCents(-1)).toThrow(RangeError);
    expect(() => assertSafeCents(19.99)).toThrow(RangeError);
    expect(() => assertSafeCents(Number.NaN)).toThrow(RangeError);
  });

  it("calcula total de linha e totais do pedido exclusivamente em inteiros", () => {
    expect(calculateLineTotalCents(8990, 3)).toBe(26970);
    expect(() => calculateLineTotalCents(8990, 0)).toThrow(RangeError);
    expect(() => calculateLineTotalCents(8990, 1.5)).toThrow(RangeError);

    const totals = calculateOrderTotalsCents({
      items: [
        { unitPriceCents: 8990, quantity: 2 },
        { unitPriceCents: 14900, quantity: 1 },
      ],
      deliveryFeeCents: 1500,
      discountCents: 1000,
    });

    expect(totals).toEqual({
      subtotalCents: 32880,
      deliveryFeeCents: 1500,
      discountCents: 1000,
      totalCents: 33380,
    });
  });

  it("limita o desconto ao valor bruto evitando total negativo", () => {
    const totals = calculateOrderTotalsCents({
      items: [{ unitPriceCents: 5000, quantity: 1 }],
      deliveryFeeCents: 1000,
      discountCents: 10000,
    });

    expect(totals.discountCents).toBe(6000);
    expect(totals.totalCents).toBe(0);
  });

  it("converte strings e numeros de reais para centavos sem erro de float", () => {
    expect(parseReaisToCents("89,90")).toBe(8990);
    expect(parseReaisToCents("R$ 1.299,90")).toBe(129990);
    expect(parseReaisToCents("149.5")).toBe(14950);
    expect(parseReaisToCents(19.99)).toBe(1999);
    expect(parseReaisToCents(0.1 + 0.2)).toBe(30);
    expect(() => parseReaisToCents("-10,00")).toThrow(RangeError);
    expect(() => parseReaisToCents("abc")).toThrow(RangeError);
  });

  it("formata centavos em BRL pt-BR", () => {
    const formatted = formatBrlFromCents(12990);
    expect(formatted).toContain("129,90");
    expect(formatted).toContain("R$");
  });
});
