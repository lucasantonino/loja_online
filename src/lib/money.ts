/**
 * Utilitarios financeiros em centavos inteiros (RN22).
 * Toda operacao monetaria evita ponto flutuante.
 */

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function assertSafeCents(value: number, fieldName = "amountCents"): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} deve ser um inteiro nao negativo em centavos.`);
  }
  return value;
}

export function calculateLineTotalCents(unitPriceCents: number, quantity: number): number {
  const safeUnitPrice = assertSafeCents(unitPriceCents, "unitPriceCents");
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError("quantity deve ser um inteiro positivo.");
  }

  const lineTotal = safeUnitPrice * quantity;
  if (!Number.isSafeInteger(lineTotal)) {
    throw new RangeError("lineTotalCents excede o limite seguro de inteiro.");
  }
  return lineTotal;
}

export interface OrderTotalsInput {
  items: ReadonlyArray<{ unitPriceCents: number; quantity: number }>;
  deliveryFeeCents: number;
  discountCents?: number;
}

export interface OrderTotalsResult {
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
}

export function calculateOrderTotalsCents(input: OrderTotalsInput): OrderTotalsResult {
  let subtotalCents = 0;

  for (const item of input.items) {
    subtotalCents += calculateLineTotalCents(item.unitPriceCents, item.quantity);
    if (!Number.isSafeInteger(subtotalCents)) {
      throw new RangeError("subtotalCents excede o limite seguro de inteiro.");
    }
  }

  const deliveryFeeCents = assertSafeCents(input.deliveryFeeCents, "deliveryFeeCents");
  const rawDiscountCents = assertSafeCents(input.discountCents ?? 0, "discountCents");
  const grossTotal = subtotalCents + deliveryFeeCents;
  const discountCents = Math.min(rawDiscountCents, grossTotal);
  const totalCents = grossTotal - discountCents;

  return {
    subtotalCents,
    deliveryFeeCents,
    discountCents,
    totalCents,
  };
}

export function formatBrlFromCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError("cents deve ser um inteiro seguro.");
  }
  return brlFormatter.format(cents / 100);
}

/**
 * Converte uma representacao em reais (string BR/US ou numero) para centavos inteiros
 * sem aritmetica binaria imprecisa.
 */
export function parseReaisToCents(raw: string | number): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) {
      throw new RangeError("Valor em reais invalido.");
    }
    return parseReaisToCents(raw.toFixed(2));
  }

  const cleaned = raw.trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (!cleaned) {
    throw new RangeError("Valor em reais vazio.");
  }

  // Aceita "129,90", "1.299,90", "129.90" ou "129"
  const hasComma = cleaned.includes(",");
  let normalized: string;

  if (hasComma) {
    // Formato brasileiro: ponto eh separador de milhar, virgula eh decimal
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // Sem virgula: se houver multiplos pontos (ex.: "1.200.000"), trata como milhar
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    normalized = dotCount > 1 ? cleaned.replace(/\./g, "") : cleaned;
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    throw new RangeError(`Formato monetario invalido: "${raw}".`);
  }

  const integerPart = Number.parseInt(match[1] ?? "0", 10);
  const fractionRaw = match[2] ?? "";
  const fractionPart = Number.parseInt(fractionRaw.padEnd(2, "0"), 10);
  const cents = integerPart * 100 + fractionPart;

  return assertSafeCents(cents, "parsedCents");
}
